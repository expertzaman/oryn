"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/server/db";
import { actionContext, AUTONOMY_AREAS, buildCtx, createWeek, DEFAULT_RULES, DEFAULT_VOICE, logActivity, snapshotBrain } from "@/server/service";
import { readWebsite, WebsiteError, normalizeUrl } from "@/server/ingest/website";
import { analyzeSite, buildBrain, DEFAULT_QUESTIONS, proposeBets } from "@/server/ai/tasks";
import { addEvidence, deleteSource, type AddResult } from "@/server/evidence";

export type Res = { ok: boolean; error?: string; info?: string };

async function setStep(step: number) {
  const { db, ws } = await actionContext();
  await db.update(schema.workspaces).set({ onboardingStep: step }).where(eq(schema.workspaces.id, ws.id));
}

export async function goToStep(step: number) {
  await setStep(Math.max(1, Math.min(5, step)));
  revalidatePath("/onboarding");
}

/* Step 1 — website */
export async function readSiteAction(_: Res, form: FormData): Promise<Res> {
  const { db, ws } = await actionContext();
  const url = String(form.get("website") ?? "");
  const company = String(form.get("company") ?? "").trim().slice(0, 80) || ws.name;
  const description = String(form.get("description") ?? "").trim().slice(0, 4000);
  const noSite = form.get("noSite") === "on";
  try {
    let pages: { url: string; title: string; text: string }[] = [];
    let meta = "";
    let origin: string | null = null;
    if (!noSite) {
      const site = await readWebsite(url);
      pages = site.pages;
      meta = site.description;
      origin = site.origin;
    } else if (description.length < 40) {
      return { ok: false, error: "Describe what you sell and who buys it in a couple of sentences (40+ characters)." };
    }
    if (description) pages.push({ url: "founder", title: "Founder description", text: description });
    const { data } = await analyzeSite(company, pages, meta);
    // replace any previous website source
    await db.delete(schema.sources).where(and(eq(schema.sources.workspaceId, ws.id), eq(schema.sources.kind, "website")));
    await db.insert(schema.sources).values({
      workspaceId: ws.id,
      kind: "website",
      title: origin ? `Website · ${new URL(origin).hostname.replace(/^www\./, "")}` : "Company description",
      content: pages.map((p) => `## ${p.title}\n${p.text}`).join("\n\n").slice(0, 40_000),
      meta: { pages: pages.map((p) => ({ url: p.url, title: p.title })) },
    });
    await db
      .update(schema.workspaces)
      .set({
        name: company,
        website: origin,
        siteRead: { summary: data.summary, product: data.product, audience: data.audience, positioning: data.positioning, competitors: data.competitors, pages: pages.map((p) => ({ url: p.url, title: p.title })) },
        questions: data.questions.length >= 3 ? data.questions : DEFAULT_QUESTIONS,
        onboardingStep: 2,
      })
      .where(eq(schema.workspaces.id, ws.id));
    await logActivity(db, ws.id, "oryn", "source", origin ? `Read ${pages.length} pages of ${new URL(origin).hostname}` : "Read your company description");
  } catch (e) {
    if (e instanceof WebsiteError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong reading the site. Try again, or describe your company instead." };
  }
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function validateUrl(url: string): Promise<Res> {
  try {
    normalizeUrl(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* Step 2 — conversation */
export async function saveAnswersAction(_: Res, form: FormData): Promise<Res> {
  const { db, ws } = await actionContext();
  const qs = ws.questions?.length ? ws.questions : DEFAULT_QUESTIONS;
  const answers = qs.map((q, i) => ({ q, a: String(form.get(`a${i}`) ?? "").trim().slice(0, 1500) })).filter((x) => x.a);
  if (answers.length < 2) return { ok: false, error: "Answer at least two questions — they’re what your website can’t tell Oryn." };
  await db.delete(schema.sources).where(and(eq(schema.sources.workspaceId, ws.id), eq(schema.sources.kind, "conversation")));
  await db.insert(schema.sources).values({ workspaceId: ws.id, kind: "conversation", title: "Founder interview", content: answers.map((a) => `Q: ${a.q}\nA: ${a.a}`).join("\n\n") });
  await db.update(schema.workspaces).set({ answers, onboardingStep: 3 }).where(eq(schema.workspaces.id, ws.id));
  revalidatePath("/onboarding");
  return { ok: true };
}

/* Step 3 — evidence */
export async function addEvidenceAction(_: AddResult | null, form: FormData): Promise<AddResult> {
  const { db, ws } = await actionContext();
  const files = form.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  const res = await addEvidence(db, ws, { files, notes: String(form.get("notes") ?? ""), notesTitle: String(form.get("notesTitle") ?? "") });
  revalidatePath("/onboarding");
  revalidatePath("/app/settings/data");
  return res;
}

export async function deleteSourceAction(id: string): Promise<Res> {
  const { db, ws } = await actionContext();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Unknown source" };
  await deleteSource(db, ws, id);
  revalidatePath("/onboarding");
  revalidatePath("/app/settings/data");
  return { ok: true };
}

/* Step 4 — build brain */
export async function buildBrainAction(): Promise<Res> {
  const { db, ws } = await actionContext();
  const ctx = await buildCtx(db, { ...ws });
  if (!ctx.excerpts.length) return { ok: false, error: "Add your website, answers or a file first." };
  const { data, source } = await buildBrain({ ...ctx, facts: [] });
  await db.delete(schema.facts).where(eq(schema.facts.workspaceId, ws.id));
  if (data.facts.length) await db.insert(schema.facts).values(data.facts.map((f) => ({ workspaceId: ws.id, ...f })));
  await db.update(schema.workspaces).set({ diagnosis: data.diagnosis, onboardingStep: 4 }).where(eq(schema.workspaces.id, ws.id));
  await snapshotBrain(db, ws, `First draft from ${ctx.excerpts.length} sources`, "oryn");
  await logActivity(db, ws.id, "oryn", "brain", `Built your Company Brain · ${data.facts.length} facts`, data.diagnosis.bottleneck, "/app/brain");
  revalidatePath("/onboarding");
  return { ok: true, info: source === "offline" ? "offline" : undefined };
}

export async function updateFactAction(id: string, text: string): Promise<Res> {
  const { db, ws } = await actionContext();
  const t = text.trim();
  if (t.length < 5) return { ok: false, error: "Write the corrected fact in a full sentence." };
  await db.update(schema.facts).set({ text: t.slice(0, 400), confirmed: true, updatedAt: new Date() }).where(and(eq(schema.facts.id, id), eq(schema.facts.workspaceId, ws.id)));
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function confirmFactAction(id: string, confirmed: boolean): Promise<Res> {
  const { db, ws } = await actionContext();
  await db.update(schema.facts).set({ confirmed }).where(and(eq(schema.facts.id, id), eq(schema.facts.workspaceId, ws.id)));
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function deleteFactAction(id: string): Promise<Res> {
  const { db, ws } = await actionContext();
  await db.delete(schema.facts).where(and(eq(schema.facts.id, id), eq(schema.facts.workspaceId, ws.id)));
  revalidatePath("/onboarding");
  return { ok: true };
}

/* Step 5 — goal, schedule, finish */
const goalSchema = z.object({
  title: z.string().trim().min(4, "Describe your goal in a few words.").max(140),
  metric: z.string().trim().min(2, "Name the number you’ll track.").max(80),
  baseline: z.union([z.literal(""), z.coerce.number().finite()]).optional(),
  target: z.union([z.literal(""), z.coerce.number().finite()]).optional(),
  unit: z.string().trim().max(24).optional(),
  dueDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  briefDay: z.coerce.number().int().min(0).max(6),
  briefHour: z.coerce.number().int().min(0).max(23),
  timezone: z.string().max(64),
});

export async function finishOnboardingAction(_: Res, form: FormData): Promise<Res> {
  const { db, ws } = await actionContext();
  const parsed = goalSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const g = parsed.data;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  if (g.dueDate && Date.parse(g.dueDate) < Date.now() - 864e5) return { ok: false, error: "Pick a target date in the future." };
  let tz = "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: g.timezone });
    tz = g.timezone || "UTC";
  } catch {
    tz = "UTC";
  }
  await db.update(schema.goals).set({ status: "archived" }).where(eq(schema.goals.workspaceId, ws.id));
  const [goal] = await db
    .insert(schema.goals)
    .values({ workspaceId: ws.id, title: g.title, metric: g.metric, baseline: num(g.baseline), current: num(g.baseline), target: num(g.target), unit: g.unit || null, dueDate: g.dueDate || null })
    .returning();
  await db
    .update(schema.workspaces)
    .set({ briefDay: g.briefDay, briefHour: g.briefHour, timezone: tz, rules: ws.rules ?? DEFAULT_RULES, voice: ws.voice ?? DEFAULT_VOICE, autonomy: Object.fromEntries(AUTONOMY_AREAS.map((a) => [a, 1])) })
    .where(eq(schema.workspaces.id, ws.id));
  await logActivity(db, ws.id, "you", "goal", `Set goal: ${g.title}`, null, "/app/goals");

  // Propose bets and activate the top two so the first week has structure.
  const fresh = { ...ws, timezone: tz };
  const ctx = await buildCtx(db, fresh);
  const { data: bets } = await proposeBets(ctx);
  const now = new Date();
  if (bets.length) {
    await db.insert(schema.bets).values(
      bets.map((b, i) => ({
        workspaceId: ws.id,
        goalId: goal.id,
        ...b,
        status: i < 2 ? "active" : "proposed",
        startedAt: i < 2 ? now : null,
        endsAt: i < 2 ? new Date(now.getTime() + b.durationDays * 864e5) : null,
      })),
    );
    await logActivity(db, ws.id, "oryn", "bet", `Proposed ${bets.length} bets · started the top 2`, bets.slice(0, 2).map((b) => b.title).join(" · "), "/app/goals");
  }
  await createWeek(db, fresh);
  await db.update(schema.workspaces).set({ stage: "active", onboardingStep: 5 }).where(eq(schema.workspaces.id, ws.id));
  redirect("/app?welcome=1");
}

export async function rereadWebsiteAction(): Promise<Res> {
  const { db, ws } = await actionContext();
  if (!ws.website) return { ok: false, error: "No website on file." };
  try {
    const site = await readWebsite(ws.website);
    const { data } = await analyzeSite(ws.name, site.pages, site.description);
    await db.delete(schema.sources).where(and(eq(schema.sources.workspaceId, ws.id), eq(schema.sources.kind, "website")));
    await db.insert(schema.sources).values({
      workspaceId: ws.id,
      kind: "website",
      title: `Website · ${new URL(site.origin).hostname.replace(/^www\./, "")}`,
      content: site.pages.map((p) => `## ${p.title}\n${p.text}`).join("\n\n").slice(0, 40_000),
      meta: { pages: site.pages.map((p) => ({ url: p.url, title: p.title })) },
    });
    await db
      .update(schema.workspaces)
      .set({ siteRead: { summary: data.summary, product: data.product, audience: data.audience, positioning: data.positioning, competitors: data.competitors, pages: site.pages.map((p) => ({ url: p.url, title: p.title })) } })
      .where(eq(schema.workspaces.id, ws.id));
    await logActivity(db, ws.id, "oryn", "source", `Re-read ${site.pages.length} pages of your website`, null, "/app/settings/data");
  } catch (e) {
    if (e instanceof WebsiteError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Couldn’t read the website right now." };
  }
  revalidatePath("/app/settings/data");
  return { ok: true };
}
