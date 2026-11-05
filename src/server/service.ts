import "server-only";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb, schema, type DB } from "./db";
import { requireUser } from "./auth";
import { computeStats, statsSummary } from "@/lib/crm";
import type { Ctx, Excerpt } from "./ai/tasks";
import { generateWeek } from "./ai/tasks";

export type Workspace = typeof schema.workspaces.$inferSelect;

export const DEFAULT_RULES = { neverPricing: true, flagUnsourced: true, askBeforeAssumed: false, custom: [] as string[] };
export const DEFAULT_VOICE = { formality: 40, directness: 65, length: 30, energy: 35, use: [] as string[], avoid: ["revolutionary", "synergy", "game-changing"], samples: "" };
export const AUTONOMY_AREAS = ["Website copy", "Follow-up emails", "Content", "Brain updates"] as const;

export async function getWorkspace(db: DB, userId: string) {
  const [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.ownerId, userId)).limit(1);
  return ws ?? null;
}

/** For pages inside /app — requires a finished onboarding. */
export async function requireActiveWorkspace() {
  const user = await requireUser();
  const db = await getDb();
  const ws = await getWorkspace(db, user.id);
  if (!ws || ws.stage !== "active") redirect("/onboarding");
  return { user, ws, db };
}

/** For server actions: returns null instead of redirecting. */
export async function actionContext() {
  const user = await requireUser();
  const db = await getDb();
  const ws = await getWorkspace(db, user.id);
  if (!ws) throw new Error("Workspace not found");
  return { user, ws, db };
}

export async function logActivity(db: DB, workspaceId: string, actor: "you" | "oryn", type: string, message: string, detail?: string | null, href?: string | null) {
  await db.insert(schema.activities).values({ workspaceId, actor, type, message: message.slice(0, 300), detail: detail?.slice(0, 500) ?? null, href: href ?? null });
}

export function isPaused(ws: Workspace) {
  if (!ws.pausedAt) return false;
  if (ws.pausedUntil && ws.pausedUntil.getTime() < Date.now()) return false;
  return true;
}

export async function snapshotBrain(db: DB, ws: Pick<Workspace, "id" | "brainVersion">, summary: string, author: "you" | "oryn") {
  const facts = await db.select().from(schema.facts).where(eq(schema.facts.workspaceId, ws.id));
  const [cur] = await db.select({ v: schema.workspaces.brainVersion }).from(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
  const version = (cur?.v ?? ws.brainVersion) + 1;
  await db.update(schema.workspaces).set({ brainVersion: version }).where(eq(schema.workspaces.id, ws.id));
  await db.insert(schema.brainVersions).values({
    workspaceId: ws.id,
    version,
    summary: summary.slice(0, 400),
    author,
    snapshot: facts.map((f) => ({ category: f.category, text: f.text, evidence: f.evidence })),
  });
  return version;
}

/** Monday (ISO) of the week containing `d` in the given IANA time zone. */
export function weekStartFor(d: Date, timeZone = "UTC") {
  let local: Date;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    local = new Date(parts + "T00:00:00Z");
  } catch {
    local = new Date(d.toISOString().slice(0, 10) + "T00:00:00Z");
  }
  const dow = (local.getUTCDay() + 6) % 7; // Mon=0
  local.setUTCDate(local.getUTCDate() - dow);
  return local.toISOString().slice(0, 10);
}

export function dayOf(bet: { startedAt: Date | null; durationDays: number }) {
  if (!bet.startedAt) return undefined;
  const day = Math.max(1, Math.floor((Date.now() - bet.startedAt.getTime()) / 864e5) + 1);
  return `day ${Math.min(day, bet.durationDays)} of ${bet.durationDays}`;
}

export async function buildCtx(db: DB, ws: Workspace): Promise<Ctx> {
  const [facts, dealRows, srcs, goal, betRows, recent, learn] = await Promise.all([
    db.select().from(schema.facts).where(eq(schema.facts.workspaceId, ws.id)).orderBy(schema.facts.category),
    db.select({ status: schema.deals.status, amount: schema.deals.amount, createdOn: schema.deals.createdOn, closeDate: schema.deals.closeDate, lostReason: schema.deals.lostReason, stage: schema.deals.stage }).from(schema.deals).where(eq(schema.deals.workspaceId, ws.id)),
    db.select().from(schema.sources).where(eq(schema.sources.workspaceId, ws.id)).orderBy(desc(schema.sources.createdAt)),
    db.select().from(schema.goals).where(and(eq(schema.goals.workspaceId, ws.id), eq(schema.goals.status, "active"))).orderBy(desc(schema.goals.createdAt)).limit(1),
    db.select().from(schema.bets).where(and(eq(schema.bets.workspaceId, ws.id), inArray(schema.bets.status, ["active", "paused", "won", "killed"]))).orderBy(desc(schema.bets.createdAt)).limit(10),
    db.select().from(schema.actions).where(and(eq(schema.actions.workspaceId, ws.id), ne(schema.actions.status, "open"))).orderBy(desc(schema.actions.createdAt)).limit(12),
    db.select().from(schema.learnings).where(eq(schema.learnings.workspaceId, ws.id)).orderBy(desc(schema.learnings.createdAt)).limit(6),
  ]);
  const stats = computeStats(dealRows);
  const statsText = statsSummary(stats);
  const order = { conversation: 0, crm: 1, notes: 2, document: 3, website: 4 } as Record<string, number>;
  const excerpts: Excerpt[] = srcs
    .slice()
    .sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9))
    .map((s) => ({ sourceId: s.id, label: s.title, kind: s.kind, text: s.kind === "crm" ? `${s.content}` : s.content }));
  return {
    company: ws.name,
    website: ws.website,
    site: ws.siteRead,
    answers: ws.answers ?? [],
    facts: facts.map((f) => ({ id: f.id, category: f.category, text: f.text, evidence: f.evidence, evidenceCount: f.evidenceCount })),
    stats,
    statsText,
    excerpts,
    goal: goal[0] ? { title: goal[0].title, metric: goal[0].metric, baseline: goal[0].baseline, target: goal[0].target, current: goal[0].current, unit: goal[0].unit, dueDate: goal[0].dueDate } : null,
    bets: betRows.map((b) => ({ id: b.id, title: b.title, hypothesis: b.hypothesis, status: b.status, metric: b.metric, dayOf: dayOf(b) })),
    recent: recent.map((a) => ({ title: a.title, status: a.status, reason: a.feedback?.reason ?? null, note: a.feedback?.note ?? null, outcome: a.outcome })),
    learnings: learn.map((l) => ({ title: l.title, believe: l.believe, changes: l.changes })),
    rules: ws.rules ?? DEFAULT_RULES,
    voice: ws.voice ?? DEFAULT_VOICE,
  };
}

export async function createWeek(db: DB, ws: Workspace, opts: { replaceCurrent?: boolean } = {}) {
  const start = weekStartFor(new Date(), ws.timezone);
  const ctx = await buildCtx(db, ws);
  const { data, source } = await generateWeek(ctx);
  if (opts.replaceCurrent) {
    const existing = await db.select().from(schema.weeks).where(and(eq(schema.weeks.workspaceId, ws.id), eq(schema.weeks.weekStart, start)));
    for (const w of existing) {
      // keep completed history: only delete still-open actions of this week
      await db.delete(schema.actions).where(and(eq(schema.actions.weekId, w.id), eq(schema.actions.status, "open")));
    }
  }
  const [week] = await db.insert(schema.weeks).values({ workspaceId: ws.id, weekStart: start, headline: data.headline, generatedBy: source }).returning();
  const betRows = await db.select({ id: schema.bets.id, title: schema.bets.title }).from(schema.bets).where(and(eq(schema.bets.workspaceId, ws.id), eq(schema.bets.status, "active")));
  const matchBet = (t: string | null) => {
    if (!t) return null;
    const l = t.toLowerCase();
    return betRows.find((b) => b.title.toLowerCase() === l)?.id ?? betRows.find((b) => l.includes(b.title.toLowerCase()) || b.title.toLowerCase().includes(l))?.id ?? null;
  };
  if (data.actions.length) {
    await db.insert(schema.actions).values(
      data.actions.map((a, i) => ({
        workspaceId: ws.id,
        weekId: week.id,
        betId: matchBet(a.bet),
        rank: i + 1,
        title: a.title,
        why: a.why,
        effort: a.effort,
        impact: a.impact,
        autonomy: a.autonomy,
        draftKind: a.draftKind,
        evidence: a.evidence,
        evidenceCount: a.evidenceCount,
        refs: a.refs,
        reasoning: a.reasoning,
        successMetric: a.successMetric,
      })),
    );
  }
  await logActivity(db, ws.id, "oryn", "brief", `Weekly brief ready · ${data.actions.length} actions`, data.headline, "/app");
  return { week, source };
}

export async function currentWeek(db: DB, ws: Workspace) {
  const [week] = await db.select().from(schema.weeks).where(eq(schema.weeks.workspaceId, ws.id)).orderBy(desc(schema.weeks.createdAt)).limit(1);
  if (!week) return { week: null, actions: [] as (typeof schema.actions.$inferSelect)[] };
  const acts = await db.select().from(schema.actions).where(eq(schema.actions.weekId, week.id)).orderBy(schema.actions.rank);
  return { week, actions: acts };
}
