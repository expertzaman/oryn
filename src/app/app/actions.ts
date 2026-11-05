"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/server/db";
import { actionContext, AUTONOMY_AREAS, buildCtx, createWeek, DEFAULT_RULES, DEFAULT_VOICE, isPaused, logActivity, snapshotBrain } from "@/server/service";
import { askOryn, buildBrain, draftForAction, learningMemo, proposeBets } from "@/server/ai/tasks";
import { destroySession, hashPassword, verifyPassword } from "@/server/auth";
import type { Evidence } from "@/server/db/schema";

export type R<T = unknown> = { ok: true; data?: T; info?: string } | { ok: false; error: string };
const uuid = z.string().uuid();
const bad = (error: string): R<never> => ({ ok: false, error });

function refreshApp() {
  revalidatePath("/app", "layout");
}

async function guardNotPaused(ws: { pausedAt: Date | null; pausedUntil: Date | null } & Record<string, unknown>) {
  if (isPaused(ws as never)) return bad("Oryn is paused. Resume it in Settings to generate new work.");
  return null;
}

/* ============ Actions (weekly) ============ */
export async function setActionStatus(id: string, status: "done" | "skipped" | "disagreed" | "open", fb?: { reason?: string; note?: string; outcome?: string }): Promise<R> {
  if (!uuid.safeParse(id).success) return bad("Unknown action");
  const { db, ws } = await actionContext();
  const [a] = await db.select().from(schema.actions).where(and(eq(schema.actions.id, id), eq(schema.actions.workspaceId, ws.id)));
  if (!a) return bad("This action no longer exists.");
  const reason = fb?.reason?.slice(0, 200);
  const note = fb?.note?.trim().slice(0, 1000);
  await db
    .update(schema.actions)
    .set({
      status,
      completedAt: status === "done" ? new Date() : null,
      feedback: status === "open" ? null : { reason, note, at: new Date().toISOString() },
      outcome: status === "done" ? fb?.outcome?.trim().slice(0, 1000) || a.outcome : status === "open" ? null : a.outcome,
    })
    .where(eq(schema.actions.id, id));
  const verb = { done: "Marked done", skipped: "Skipped", disagreed: "Disagreed with", open: "Reopened" }[status];
  await logActivity(db, ws.id, "you", "action", `${verb}: ${a.title}`, reason ? `${reason}${note ? ` — ${note}` : ""}` : note ?? null, `/app/actions/${id}`);
  refreshApp();
  return { ok: true };
}

export async function recordOutcome(id: string, outcome: string): Promise<R> {
  if (!uuid.safeParse(id).success) return bad("Unknown action");
  const { db, ws } = await actionContext();
  const o = outcome.trim();
  if (o.length < 3) return bad("Describe what happened in a few words.");
  await db.update(schema.actions).set({ outcome: o.slice(0, 1000) }).where(and(eq(schema.actions.id, id), eq(schema.actions.workspaceId, ws.id)));
  await logActivity(db, ws.id, "you", "outcome", "Recorded an outcome", o.slice(0, 200), `/app/actions/${id}`);
  refreshApp();
  return { ok: true };
}

export async function regenerateWeek(): Promise<R> {
  const { db, ws } = await actionContext();
  const g = await guardNotPaused(ws);
  if (g) return g;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.weeks).where(and(eq(schema.weeks.workspaceId, ws.id), sql`${schema.weeks.createdAt} > now() - interval '1 hour'`));
  if (Number(n) >= 5) return bad("You’ve regenerated the brief several times this hour. Try again later.");
  const { source } = await createWeek(db, ws, { replaceCurrent: true });
  refreshApp();
  return { ok: true, info: source };
}

/* ============ Drafts ============ */
export async function createDraftForAction(actionId: string, instruction?: string): Promise<R<{ id: string }>> {
  if (!uuid.safeParse(actionId).success) return bad("Unknown action");
  const { db, ws } = await actionContext();
  const g = await guardNotPaused(ws);
  if (g) return g;
  const [a] = await db.select().from(schema.actions).where(and(eq(schema.actions.id, actionId), eq(schema.actions.workspaceId, ws.id)));
  if (!a) return bad("This action no longer exists.");
  const ctx = await buildCtx(db, ws);
  const { data, source } = await draftForAction(ctx, a, instruction);
  const [d] = await db
    .insert(schema.drafts)
    .values({ workspaceId: ws.id, actionId: a.id, kind: data.kind, title: data.title || a.title, recipient: data.recipient, subject: data.subject, body: data.body, flags: data.flags })
    .returning({ id: schema.drafts.id });
  await logActivity(db, ws.id, "oryn", "draft", `Wrote a ${data.kind} draft`, a.title, `/app/drafts/${d.id}`);
  refreshApp();
  return { ok: true, data: { id: d.id }, info: source };
}

export async function regenerateDraft(id: string, instruction?: string): Promise<R> {
  if (!uuid.safeParse(id).success) return bad("Unknown draft");
  const { db, ws } = await actionContext();
  const g = await guardNotPaused(ws);
  if (g) return g;
  const [d] = await db.select().from(schema.drafts).where(and(eq(schema.drafts.id, id), eq(schema.drafts.workspaceId, ws.id)));
  if (!d) return bad("This draft no longer exists.");
  const ctx = await buildCtx(db, ws);
  const [a] = d.actionId ? await db.select().from(schema.actions).where(eq(schema.actions.id, d.actionId)) : [];
  const { data, source } = await draftForAction(ctx, a ?? { title: d.title, why: "", draftKind: d.kind }, instruction);
  await db.update(schema.drafts).set({ recipient: data.recipient, subject: data.subject, body: data.body, flags: data.flags, updatedAt: new Date(), status: "draft" }).where(eq(schema.drafts.id, id));
  revalidatePath(`/app/drafts/${id}`);
  return { ok: true, info: source };
}

const draftSchema = z.object({ recipient: z.string().max(200).optional(), subject: z.string().max(200).optional(), body: z.string().min(1, "The draft can’t be empty.").max(10000), title: z.string().trim().min(1).max(140).optional() });
export async function saveDraft(id: string, input: z.infer<typeof draftSchema>): Promise<R> {
  if (!uuid.safeParse(id).success) return bad("Unknown draft");
  const p = draftSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues[0].message);
  const { db, ws } = await actionContext();
  const [d] = await db.select({ flags: schema.drafts.flags }).from(schema.drafts).where(and(eq(schema.drafts.id, id), eq(schema.drafts.workspaceId, ws.id)));
  if (!d) return bad("This draft no longer exists.");
  // drop flags whose text was edited away
  const flags = d.flags.filter((f) => p.data.body.includes(f.text));
  await db.update(schema.drafts).set({ ...p.data, flags, updatedAt: new Date() }).where(eq(schema.drafts.id, id));
  revalidatePath(`/app/drafts/${id}`);
  revalidatePath("/app/drafts");
  return { ok: true };
}

export async function resolveFlag(id: string, text: string, replacement: string | null): Promise<R> {
  const { db, ws } = await actionContext();
  const [d] = await db.select().from(schema.drafts).where(and(eq(schema.drafts.id, id), eq(schema.drafts.workspaceId, ws.id)));
  if (!d) return bad("This draft no longer exists.");
  const body = replacement != null && d.body.includes(text) ? d.body.replace(text, replacement) : d.body;
  await db.update(schema.drafts).set({ body, flags: d.flags.filter((f) => f.text !== text), updatedAt: new Date() }).where(eq(schema.drafts.id, id));
  revalidatePath(`/app/drafts/${id}`);
  return { ok: true };
}

export async function setDraftStatus(id: string, status: "draft" | "copied" | "archived"): Promise<R> {
  if (!uuid.safeParse(id).success) return bad("Unknown draft");
  const { db, ws } = await actionContext();
  const [d] = await db.update(schema.drafts).set({ status, updatedAt: new Date() }).where(and(eq(schema.drafts.id, id), eq(schema.drafts.workspaceId, ws.id))).returning({ title: schema.drafts.title });
  if (!d) return bad("This draft no longer exists.");
  if (status === "copied") await logActivity(db, ws.id, "you", "draft", `Copied draft: ${d.title}`, null, `/app/drafts/${id}`);
  refreshApp();
  return { ok: true };
}

export async function deleteDraft(id: string): Promise<R> {
  if (!uuid.safeParse(id).success) return bad("Unknown draft");
  const { db, ws } = await actionContext();
  await db.delete(schema.drafts).where(and(eq(schema.drafts.id, id), eq(schema.drafts.workspaceId, ws.id)));
  refreshApp();
  redirect("/app/drafts");
}

const voiceSchema = z.object({
  formality: z.coerce.number().int().min(0).max(100),
  directness: z.coerce.number().int().min(0).max(100),
  length: z.coerce.number().int().min(0).max(100),
  energy: z.coerce.number().int().min(0).max(100),
  use: z.array(z.string().trim().min(1).max(40)).max(20),
  avoid: z.array(z.string().trim().min(1).max(40)).max(20),
  samples: z.string().max(8000),
});
export async function saveVoice(input: z.infer<typeof voiceSchema>): Promise<R> {
  const p = voiceSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues[0].message);
  const { db, ws } = await actionContext();
  await db.update(schema.workspaces).set({ voice: p.data }).where(eq(schema.workspaces.id, ws.id));
  await logActivity(db, ws.id, "you", "voice", "Updated voice profile");
  revalidatePath("/app/drafts/voice");
  return { ok: true };
}

/* ============ Goals & bets ============ */
const goalSchema = z.object({
  title: z.string().trim().min(4, "Describe the goal in a few words.").max(140),
  metric: z.string().trim().min(2, "Name the metric.").max(80),
  baseline: z.number().finite().nullable(),
  target: z.number().finite().nullable(),
  current: z.number().finite().nullable(),
  unit: z.string().trim().max(24).nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
export async function saveGoal(goalId: string | null, input: z.infer<typeof goalSchema>): Promise<R> {
  const p = goalSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues[0].message);
  const { db, ws } = await actionContext();
  if (goalId) {
    if (!uuid.safeParse(goalId).success) return bad("Unknown goal");
    await db.update(schema.goals).set(p.data).where(and(eq(schema.goals.id, goalId), eq(schema.goals.workspaceId, ws.id)));
    await logActivity(db, ws.id, "you", "goal", `Updated goal: ${p.data.title}`, null, "/app/goals");
  } else {
    await db.update(schema.goals).set({ status: "archived" }).where(and(eq(schema.goals.workspaceId, ws.id), eq(schema.goals.status, "active")));
    const [g] = await db.insert(schema.goals).values({ workspaceId: ws.id, ...p.data }).returning({ id: schema.goals.id });
    await db.update(schema.bets).set({ goalId: g.id }).where(and(eq(schema.bets.workspaceId, ws.id), inArray(schema.bets.status, ["active", "paused", "proposed"])));
    await logActivity(db, ws.id, "you", "goal", `Set a new goal: ${p.data.title}`, null, "/app/goals");
  }
  refreshApp();
  return { ok: true };
}

export async function proposeBetsAction(): Promise<R<{ count: number }>> {
  const { db, ws } = await actionContext();
  const g = await guardNotPaused(ws);
  if (g) return g;
  const ctx = await buildCtx(db, ws);
  const { data, source } = await proposeBets(ctx);
  const [goal] = await db.select({ id: schema.goals.id }).from(schema.goals).where(and(eq(schema.goals.workspaceId, ws.id), eq(schema.goals.status, "active"))).limit(1);
  await db.update(schema.bets).set({ status: "dismissed" }).where(and(eq(schema.bets.workspaceId, ws.id), eq(schema.bets.status, "proposed")));
  if (data.length) await db.insert(schema.bets).values(data.map((b) => ({ workspaceId: ws.id, goalId: goal?.id ?? null, ...b, status: "proposed" })));
  await logActivity(db, ws.id, "oryn", "bet", `Proposed ${data.length} bets`, data.map((b) => b.title).join(" · "), "/app/goals");
  refreshApp();
  return { ok: true, data: { count: data.length }, info: source };
}

const newBetSchema = z.object({
  title: z.string().trim().min(3, "Give the bet a short name.").max(80),
  hypothesis: z.string().trim().min(10, "Write the hypothesis as “If … then …”.").max(400),
  metric: z.string().trim().min(2, "Name the metric.").max(120),
  durationDays: z.number().int().min(7).max(60),
  killCriteria: z.string().trim().max(200),
});
export async function createBet(input: z.infer<typeof newBetSchema>, start: boolean): Promise<R<{ id: string }>> {
  const p = newBetSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues[0].message);
  const { db, ws } = await actionContext();
  if (start) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.bets).where(and(eq(schema.bets.workspaceId, ws.id), eq(schema.bets.status, "active")));
    if (Number(n) >= 3) return bad("You already have 3 active bets. Pause or end one first.");
  }
  const [goal] = await db.select({ id: schema.goals.id }).from(schema.goals).where(and(eq(schema.goals.workspaceId, ws.id), eq(schema.goals.status, "active"))).limit(1);
  const now = new Date();
  const [b] = await db
    .insert(schema.bets)
    .values({ workspaceId: ws.id, goalId: goal?.id ?? null, ...p.data, evidence: "assumed", status: start ? "active" : "proposed", startedAt: start ? now : null, endsAt: start ? new Date(now.getTime() + p.data.durationDays * 864e5) : null })
    .returning({ id: schema.bets.id });
  await logActivity(db, ws.id, "you", "bet", `${start ? "Started" : "Saved"} bet: ${p.data.title}`, null, `/app/bets/${b.id}`);
  refreshApp();
  return { ok: true, data: { id: b.id } };
}

export async function setBetStatus(id: string, status: "active" | "paused" | "dismissed", pauseId?: string): Promise<R> {
  if (!uuid.safeParse(id).success) return bad("Unknown bet");
  const { db, ws } = await actionContext();
  const [b] = await db.select().from(schema.bets).where(and(eq(schema.bets.id, id), eq(schema.bets.workspaceId, ws.id)));
  if (!b) return bad("This bet no longer exists.");
  if (status === "active" && b.status !== "active") {
    if (pauseId && uuid.safeParse(pauseId).success) await db.update(schema.bets).set({ status: "paused" }).where(and(eq(schema.bets.id, pauseId), eq(schema.bets.workspaceId, ws.id), eq(schema.bets.status, "active")));
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.bets).where(and(eq(schema.bets.workspaceId, ws.id), eq(schema.bets.status, "active")));
    if (Number(n) >= 3) return bad("LIMIT");
    const now = new Date();
    // Resuming keeps the remaining time; starting fresh sets a new window.
    const startedAt = b.startedAt ?? now;
    const endsAt = b.endsAt && b.endsAt > now ? b.endsAt : new Date(now.getTime() + b.durationDays * 864e5);
    await db.update(schema.bets).set({ status: "active", startedAt, endsAt }).where(eq(schema.bets.id, id));
  } else {
    await db.update(schema.bets).set({ status }).where(eq(schema.bets.id, id));
  }
  const verb = { active: b.status === "paused" ? "Resumed" : "Started", paused: "Paused", dismissed: "Dismissed" }[status];
  await logActivity(db, ws.id, "you", "bet", `${verb} bet: ${b.title}`, null, `/app/bets/${id}`);
  refreshApp();
  return { ok: true };
}

export async function extendBet(id: string, days: number): Promise<R> {
  if (!uuid.safeParse(id).success || !Number.isInteger(days) || days < 1 || days > 30) return bad("Choose 1–30 days.");
  const { db, ws } = await actionContext();
  const [b] = await db.select().from(schema.bets).where(and(eq(schema.bets.id, id), eq(schema.bets.workspaceId, ws.id)));
  if (!b) return bad("This bet no longer exists.");
  const base = b.endsAt && b.endsAt > new Date() ? b.endsAt : new Date();
  await db.update(schema.bets).set({ endsAt: new Date(base.getTime() + days * 864e5), durationDays: b.durationDays + days }).where(eq(schema.bets.id, id));
  await logActivity(db, ws.id, "you", "bet", `Extended bet by ${days} days: ${b.title}`, null, `/app/bets/${id}`);
  refreshApp();
  return { ok: true };
}

export async function endBet(id: string, outcome: "won" | "killed", note: string): Promise<R<{ learningId: string }>> {
  if (!uuid.safeParse(id).success) return bad("Unknown bet");
  const { db, ws } = await actionContext();
  const [b] = await db.select().from(schema.bets).where(and(eq(schema.bets.id, id), eq(schema.bets.workspaceId, ws.id)));
  if (!b) return bad("This bet no longer exists.");
  if (b.status === "won" || b.status === "killed") return bad("This bet has already ended.");
  const n = note.trim().slice(0, 1500);
  if (n.length < 5) return bad("Write a sentence about what happened — it becomes the learning.");
  await db.update(schema.bets).set({ status: outcome, endedAt: new Date(), resultNote: n }).where(eq(schema.bets.id, id));
  const acts = await db.select().from(schema.actions).where(eq(schema.actions.betId, id));
  const ctx = await buildCtx(db, ws);
  const { data } = await learningMemo(ctx, { title: b.title, hypothesis: b.hypothesis, metric: b.metric, result: n, outcome }, acts.map((a) => ({ title: a.title, status: a.status, outcome: a.outcome, reason: a.feedback?.reason })));
  const [l] = await db.insert(schema.learnings).values({ workspaceId: ws.id, betId: id, ...data }).returning({ id: schema.learnings.id });
  await logActivity(db, ws.id, "you", "bet", `${outcome === "won" ? "Closed as won" : "Killed"}: ${b.title}`, n, `/app/bets/${id}`);
  await logActivity(db, ws.id, "oryn", "learning", `Wrote a learning memo: ${data.title}`, null, `/app/learnings/${l.id}`);
  refreshApp();
  return { ok: true, data: { learningId: l.id } };
}

/* ============ Company Brain ============ */
const factSchema = z.object({ category: z.string().trim().min(2).max(40), text: z.string().trim().min(5, "Write the fact as a full sentence.").max(400), evidence: z.enum(["supported", "weak", "assumed"]) });
export async function saveFact(id: string | null, input: z.infer<typeof factSchema>): Promise<R> {
  const p = factSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues[0].message);
  const { db, ws } = await actionContext();
  if (id) {
    if (!uuid.safeParse(id).success) return bad("Unknown fact");
    const [f] = await db.select().from(schema.facts).where(and(eq(schema.facts.id, id), eq(schema.facts.workspaceId, ws.id)));
    if (!f) return bad("This fact no longer exists.");
    if (f.text === p.data.text && f.category === p.data.category && f.evidence === p.data.evidence) return { ok: true };
    await db.update(schema.facts).set({ ...p.data, confirmed: true, updatedAt: new Date() }).where(eq(schema.facts.id, id));
    const v = await snapshotBrain(db, ws, `You corrected: ${p.data.text.slice(0, 120)}`, "you");
    await logActivity(db, ws.id, "you", "brain", `Corrected a fact · Brain v${v}`, p.data.text, "/app/brain");
  } else {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.facts).where(eq(schema.facts.workspaceId, ws.id));
    if (Number(n) >= 120) return bad("Your Brain has 120 facts. Remove some before adding more.");
    await db.insert(schema.facts).values({ workspaceId: ws.id, ...p.data, confirmed: true, refs: [{ label: "Added by you", kind: "notes" }] });
    const v = await snapshotBrain(db, ws, `You added: ${p.data.text.slice(0, 120)}`, "you");
    await logActivity(db, ws.id, "you", "brain", `Added a fact · Brain v${v}`, p.data.text, "/app/brain");
  }
  refreshApp();
  return { ok: true };
}

export async function deleteFact(id: string): Promise<R> {
  if (!uuid.safeParse(id).success) return bad("Unknown fact");
  const { db, ws } = await actionContext();
  const [f] = await db.delete(schema.facts).where(and(eq(schema.facts.id, id), eq(schema.facts.workspaceId, ws.id))).returning({ text: schema.facts.text });
  if (!f) return bad("This fact no longer exists.");
  const v = await snapshotBrain(db, ws, `You removed: ${f.text.slice(0, 120)}`, "you");
  await logActivity(db, ws.id, "you", "brain", `Removed a fact · Brain v${v}`, f.text, "/app/brain/versions");
  refreshApp();
  return { ok: true };
}

export async function decideProposal(id: string, decision: "accepted" | "rejected", editedText?: string): Promise<R> {
  if (!uuid.safeParse(id).success) return bad("Unknown proposal");
  const { db, ws } = await actionContext();
  const [p] = await db.select().from(schema.proposals).where(and(eq(schema.proposals.id, id), eq(schema.proposals.workspaceId, ws.id)));
  if (!p) return bad("This proposal no longer exists.");
  if (p.status !== "pending") return bad("This proposal was already decided.");
  const text = (editedText ?? p.proposedText).trim().slice(0, 400);
  await db.update(schema.proposals).set({ status: decision, decidedAt: new Date(), proposedText: text }).where(eq(schema.proposals.id, id));
  if (decision === "accepted") {
    if (p.factId) {
      const upd = await db.update(schema.facts).set({ text, evidence: p.evidence, evidenceCount: p.evidenceCount, refs: p.refs, updatedAt: new Date() }).where(and(eq(schema.facts.id, p.factId), eq(schema.facts.workspaceId, ws.id))).returning({ id: schema.facts.id });
      if (!upd.length) await db.insert(schema.facts).values({ workspaceId: ws.id, category: p.category, text, evidence: p.evidence, evidenceCount: p.evidenceCount, refs: p.refs });
    } else {
      await db.insert(schema.facts).values({ workspaceId: ws.id, category: p.category, text, evidence: p.evidence, evidenceCount: p.evidenceCount, refs: p.refs });
    }
    const v = await snapshotBrain(db, ws, `Accepted proposal: ${text.slice(0, 120)}`, "you");
    await logActivity(db, ws.id, "you", "brain", `Accepted a proposal · Brain v${v}`, text, "/app/brain");
  } else {
    await logActivity(db, ws.id, "you", "brain", "Rejected a proposal", p.proposedText, "/app/brain/proposals");
  }
  refreshApp();
  return { ok: true };
}

export async function rebuildBrain(): Promise<R> {
  const { db, ws } = await actionContext();
  const g = await guardNotPaused(ws);
  if (g) return g;
  const ctx = await buildCtx(db, ws);
  if (!ctx.excerpts.length) return bad("Add some sources first.");
  const { data, source } = await buildBrain(ctx);
  // Keep founder-confirmed facts; propose the rest instead of overwriting.
  const existing = new Set(ctx.facts.map((f) => f.text.toLowerCase()));
  const fresh = data.facts.filter((f) => !existing.has(f.text.toLowerCase()));
  if (fresh.length) await db.insert(schema.proposals).values(fresh.slice(0, 10).map((f) => ({ workspaceId: ws.id, kind: "add", category: f.category, proposedText: f.text, rationale: "Found while re-reading all your sources.", evidence: f.evidence, evidenceCount: f.evidenceCount, refs: f.refs })));
  await db.update(schema.workspaces).set({ diagnosis: data.diagnosis }).where(eq(schema.workspaces.id, ws.id));
  await logActivity(db, ws.id, "oryn", "brain", `Re-read all sources · ${fresh.length} proposals`, data.diagnosis.bottleneck, "/app/brain/proposals");
  refreshApp();
  return { ok: true, info: source, data: { proposals: fresh.length } };
}

export async function restoreVersion(versionId: string): Promise<R> {
  if (!uuid.safeParse(versionId).success) return bad("Unknown version");
  const { db, ws } = await actionContext();
  const [v] = await db.select().from(schema.brainVersions).where(and(eq(schema.brainVersions.id, versionId), eq(schema.brainVersions.workspaceId, ws.id)));
  if (!v) return bad("This version no longer exists.");
  await db.delete(schema.facts).where(eq(schema.facts.workspaceId, ws.id));
  if (v.snapshot.length) await db.insert(schema.facts).values(v.snapshot.map((f) => ({ workspaceId: ws.id, category: f.category, text: f.text, evidence: f.evidence as Evidence, refs: [{ label: `Restored from v${v.version}` }] })));
  const nv = await snapshotBrain(db, ws, `Restored v${v.version}`, "you");
  await logActivity(db, ws.id, "you", "brain", `Restored Brain v${v.version} as v${nv}`, null, "/app/brain/versions");
  refreshApp();
  return { ok: true };
}

/* ============ Learnings ============ */
export async function reactToLearning(id: string, reaction: "agree" | "disagree" | null): Promise<R> {
  if (!uuid.safeParse(id).success) return bad("Unknown learning");
  const { db, ws } = await actionContext();
  await db.update(schema.learnings).set({ reaction }).where(and(eq(schema.learnings.id, id), eq(schema.learnings.workspaceId, ws.id)));
  revalidatePath(`/app/learnings/${id}`);
  return { ok: true };
}

/* ============ Ask ============ */
export async function ask(question: string): Promise<R> {
  const q = question.trim();
  if (q.length < 2) return bad("Type a question.");
  if (q.length > 1500) return bad("Keep questions under 1,500 characters.");
  const { db, ws } = await actionContext();
  const g = await guardNotPaused(ws);
  if (g) return g;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.messages).where(and(eq(schema.messages.workspaceId, ws.id), eq(schema.messages.role, "user"), sql`${schema.messages.createdAt} > now() - interval '1 hour'`));
  if (Number(n) >= 40) return bad("You’ve asked a lot this hour. Take a breather and try again soon.");
  const history = (await db.select().from(schema.messages).where(eq(schema.messages.workspaceId, ws.id)).orderBy(desc(schema.messages.createdAt)).limit(6)).reverse();
  await db.insert(schema.messages).values({ workspaceId: ws.id, role: "user", content: q });
  const ctx = await buildCtx(db, ws);
  const r = await askOryn(ctx, history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })), q);
  await db.insert(schema.messages).values({ workspaceId: ws.id, role: "assistant", content: r.answer + (r.followUps.length ? `\n\n<!--followups:${JSON.stringify(r.followUps)}-->` : ""), refs: r.refs });
  revalidatePath("/app/ask");
  return { ok: true, info: r.source };
}

export async function clearChat(): Promise<R> {
  const { db, ws } = await actionContext();
  await db.delete(schema.messages).where(eq(schema.messages.workspaceId, ws.id));
  revalidatePath("/app/ask");
  return { ok: true };
}

/* ============ Settings ============ */
const briefSchema = z.object({ briefDay: z.number().int().min(0).max(6), briefHour: z.number().int().min(0).max(23), timezone: z.string().min(1).max(64), name: z.string().trim().min(1, "Company name can’t be empty.").max(80) });
export async function saveWorkspaceSettings(input: z.infer<typeof briefSchema>): Promise<R> {
  const p = briefSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues[0].message);
  try {
    new Intl.DateTimeFormat("en", { timeZone: p.data.timezone });
  } catch {
    return bad("That time zone isn’t recognised. Use a name like Europe/London.");
  }
  const { db, ws } = await actionContext();
  await db.update(schema.workspaces).set(p.data).where(eq(schema.workspaces.id, ws.id));
  refreshApp();
  return { ok: true };
}

const rulesSchema = z.object({ neverPricing: z.boolean(), flagUnsourced: z.boolean(), askBeforeAssumed: z.boolean(), custom: z.array(z.string().trim().min(3).max(200)).max(15) });
export async function saveRules(input: z.infer<typeof rulesSchema>, autonomy: Record<string, number>): Promise<R> {
  const p = rulesSchema.safeParse(input);
  if (!p.success) return bad(p.error.issues[0].message);
  const a: Record<string, number> = {};
  for (const k of AUTONOMY_AREAS) {
    const v = Number(autonomy[k]);
    a[k] = Number.isInteger(v) && v >= 0 && v <= 2 ? v : 1;
  }
  const { db, ws } = await actionContext();
  await db.update(schema.workspaces).set({ rules: p.data, autonomy: a }).where(eq(schema.workspaces.id, ws.id));
  await logActivity(db, ws.id, "you", "rules", "Updated rules & autonomy");
  refreshApp();
  return { ok: true };
}

export async function setPause(mode: "week" | "indefinite" | "resume"): Promise<R> {
  const { db, ws } = await actionContext();
  if (mode === "resume") {
    await db.update(schema.workspaces).set({ pausedAt: null, pausedUntil: null }).where(eq(schema.workspaces.id, ws.id));
    await logActivity(db, ws.id, "you", "pause", "Resumed Oryn");
  } else {
    await db.update(schema.workspaces).set({ pausedAt: new Date(), pausedUntil: mode === "week" ? new Date(Date.now() + 7 * 864e5) : null }).where(eq(schema.workspaces.id, ws.id));
    await logActivity(db, ws.id, "you", "pause", mode === "week" ? "Paused Oryn for 1 week" : "Paused Oryn until resumed");
  }
  refreshApp();
  return { ok: true };
}

export async function changePassword(current: string, next: string): Promise<R> {
  if (next.length < 8 || next.length > 128 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return bad("Use 8+ characters with at least one letter and one number.");
  const { db, user } = await actionContext();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  if (!u || !(await verifyPassword(current, u.passwordHash))) return bad("Your current password is incorrect.");
  await db.update(schema.users).set({ passwordHash: await hashPassword(next) }).where(eq(schema.users.id, user.id));
  return { ok: true };
}

export async function updateProfile(name: string): Promise<R> {
  const n = name.trim();
  if (!n || n.length > 80) return bad("Enter a name up to 80 characters.");
  const { db, user } = await actionContext();
  await db.update(schema.users).set({ name: n }).where(eq(schema.users.id, user.id));
  refreshApp();
  return { ok: true };
}

export async function deleteAccount(confirmText: string, password: string): Promise<R> {
  if (confirmText !== "DELETE") return bad("Type DELETE to confirm.");
  const { db, user } = await actionContext();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  if (!u || !(await verifyPassword(password, u.passwordHash))) return bad("Your password is incorrect.");
  await destroySession();
  await db.delete(schema.users).where(eq(schema.users.id, user.id)); // cascades to workspace & all content
  redirect("/?deleted=1");
}

export async function resetVoiceRules(): Promise<R> {
  const { db, ws } = await actionContext();
  await db.update(schema.workspaces).set({ voice: DEFAULT_VOICE, rules: DEFAULT_RULES }).where(eq(schema.workspaces.id, ws.id));
  refreshApp();
  return { ok: true };
}

