import "server-only";
import { z } from "zod";
import { generateJson, zEvidence, zStr, type ChatMsg, type GenSource } from "./provider";
import type { DealStats } from "@/lib/crm";
import type { Evidence, QA, SiteRead, SourceRef, Rules, Voice } from "../db/schema";

export const CATEGORIES = ["ICP", "Positioning", "Product", "Competitors", "Pricing", "Objections", "Win/loss", "Channels"] as const;

export type Excerpt = { sourceId: string; label: string; kind: string; text: string };
export type CtxFact = { id: string; category: string; text: string; evidence: Evidence; evidenceCount?: string | null };
export type Ctx = {
  company: string;
  website?: string | null;
  site?: SiteRead | null;
  answers: QA[];
  facts: CtxFact[];
  stats: DealStats;
  statsText: string;
  excerpts: Excerpt[];
  goal?: { title: string; metric: string; baseline: number | null; target: number | null; current: number | null; unit: string | null; dueDate: string | null } | null;
  bets: { id: string; title: string; hypothesis: string; status: string; metric: string; dayOf?: string }[];
  recent: { title: string; status: string; reason?: string | null; note?: string | null; outcome?: string | null }[];
  learnings: { title: string; believe: string; changes: string }[];
  rules?: Rules | null;
  voice?: Voice | null;
};

const SYSTEM = `You are Oryn, a growth intelligence analyst for B2B SaaS founders.
Rules:
- Be concrete and specific to THIS company. Use numbers only when they appear in the evidence provided. Never invent customers, quotes, metrics or percentages.
- Evidence levels: "supported" = backed by CRM counts (5+ deals) or several independent sources; "weak" = 1-4 data points or a single source; "assumed" = inferred, founder opinion, or no data.
- Cite sources only by the exact labels given in the SOURCES list.
- Plain, direct business English. No hype words (revolutionary, unlock, leverage, supercharge, game-changing, synergy, seamless). No emojis.
- Respond with a single JSON object only.`;

function clip(s: string | null | undefined, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function contextBlock(c: Ctx, opts: { excerptChars?: number; maxExcerpts?: number } = {}) {
  const per = opts.excerptChars ?? 1400;
  const ex = c.excerpts.slice(0, opts.maxExcerpts ?? 8);
  return [
    `COMPANY: ${c.company}${c.website ? ` (${c.website})` : ""}`,
    c.site?.summary ? `WEBSITE SUMMARY: ${clip(c.site.summary, 600)}` : "",
    c.answers.length ? `FOUNDER ANSWERS:\n${c.answers.map((a) => `- Q: ${clip(a.q, 200)}\n  A: ${clip(a.a, 500)}`).join("\n")}` : "",
    `CRM STATS: ${c.statsText}`,
    c.facts.length ? `COMPANY BRAIN (current facts):\n${c.facts.slice(0, 30).map((f) => `- [${f.category}] ${clip(f.text, 220)} (${f.evidence})`).join("\n")}` : "",
    c.goal ? `GOAL: ${c.goal.title} — metric ${c.goal.metric}${c.goal.baseline != null ? `, from ${c.goal.baseline}` : ""}${c.goal.target != null ? ` to ${c.goal.target}` : ""}${c.goal.unit ? ` ${c.goal.unit}` : ""}${c.goal.dueDate ? ` by ${c.goal.dueDate}` : ""}${c.goal.current != null ? `; currently ${c.goal.current}` : ""}` : "",
    c.bets.length ? `BETS:\n${c.bets.map((b) => `- "${b.title}" [${b.status}${b.dayOf ? `, ${b.dayOf}` : ""}]: ${clip(b.hypothesis, 220)}`).join("\n")}` : "",
    c.recent.length ? `RECENT ACTIONS & FEEDBACK:\n${c.recent.slice(0, 12).map((a) => `- ${clip(a.title, 120)} → ${a.status}${a.reason ? ` (reason: ${clip(a.reason, 120)})` : ""}${a.note ? ` note: ${clip(a.note, 160)}` : ""}${a.outcome ? ` outcome: ${clip(a.outcome, 160)}` : ""}`).join("\n")}` : "",
    c.learnings.length ? `LEARNINGS:\n${c.learnings.slice(0, 6).map((l) => `- ${clip(l.title, 140)} → now believe: ${clip(l.believe, 200)}`).join("\n")}` : "",
    c.rules ? `RULES: ${[c.rules.neverPricing ? "never mention pricing in outbound copy" : "", c.rules.flagUnsourced ? "flag unsourced claims" : "", ...(c.rules.custom ?? [])].filter(Boolean).join("; ") || "none"}` : "",
    ex.length ? `SOURCES (cite by label):\n${ex.map((e) => `### ${e.label} [${e.kind}]\n${clip(e.text, per)}`).join("\n\n")}` : "SOURCES: (none yet)",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const zRefs = z
  .array(z.union([z.string(), z.object({ label: zStr(120), quote: zStr(300).optional().nullable() })]))
  .catch([])
  .transform((arr) => arr.map((r) => (typeof r === "string" ? { label: r.slice(0, 120), quote: null } : { label: r.label, quote: r.quote ?? null })).slice(0, 4));

export function resolveRefs(refs: { label: string; quote?: string | null }[], excerpts: Excerpt[]): SourceRef[] {
  const out: SourceRef[] = [];
  for (const r of refs) {
    const l = r.label.toLowerCase();
    const hit = excerpts.find((e) => e.label.toLowerCase() === l) ?? excerpts.find((e) => l.includes(e.label.toLowerCase()) || e.label.toLowerCase().includes(l));
    if (!hit) continue; // drop hallucinated sources
    if (out.some((o) => o.sourceId === hit.sourceId)) continue;
    out.push({ sourceId: hit.sourceId, label: hit.label, kind: hit.kind, quote: r.quote ? r.quote.slice(0, 300) : null });
  }
  return out;
}

/* ===================== 1. Website analysis ===================== */
const zSite = z.object({
  summary: zStr(700),
  product: zStr(300).catch(""),
  audience: zStr(300).catch(""),
  positioning: zStr(300).catch(""),
  competitors: z.array(zStr(60)).catch([]).transform((a) => a.slice(0, 5)),
  questions: z.array(zStr(220)).min(3).transform((a) => a.slice(0, 5)),
});
export type SiteAnalysis = z.infer<typeof zSite>;

export const DEFAULT_QUESTIONS = [
  "Who signs the contract when you win — which role, and at what kind of company?",
  "What is the one growth number you most want to move this quarter, and where is it today?",
  "When you lose a deal, what do you lose to most often — a competitor, a spreadsheet, or doing nothing?",
  "What do your best customers say made them buy?",
  "Which channel brings in your best leads today?",
];

export async function analyzeSite(company: string, pages: { url: string; title: string; text: string }[], description: string) {
  const text = pages.map((p) => `### ${p.title} (${p.url})\n${clip(p.text, 3500)}`).join("\n\n");
  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Read this company's public website and summarise it for a growth analyst.
Return JSON: {"summary": 2-3 sentences on what they sell and to whom, "product": short, "audience": who it's for as stated on the site, "positioning": the main promise, "competitors": names explicitly mentioned or strongly implied (may be empty), "questions": exactly 5 short questions to ask the founder that the website cannot answer — about buyer, goal metric, why deals are lost, why customers buy, best channel. Make each question specific to this company.}

COMPANY: ${company}
META DESCRIPTION: ${description}

${text}`,
    },
  ];
  return generateJson(zSite, messages, () => ({
    summary: clip(description || pages[0]?.text.split("\n").slice(0, 3).join(" ") || `${company} website`, 600),
    product: "",
    audience: "",
    positioning: clip(pages[0]?.title, 200),
    competitors: [],
    questions: DEFAULT_QUESTIONS,
  }), { size: "large", maxTokens: 900 });
}

/* ===================== 2. Build brain ===================== */
const zFact = z.object({
  category: zStr(40).transform((c) => (CATEGORIES as readonly string[]).find((k) => k.toLowerCase() === c.toLowerCase()) ?? "Positioning"),
  text: zStr(320),
  evidence: zEvidence,
  evidenceCount: zStr(60).optional().nullable().catch(null),
  refs: zRefs,
});
const zBrain = z.object({
  facts: z.array(zFact).min(3).transform((a) => a.filter((f) => f.text.length > 8).slice(0, 16)),
  diagnosis: z.object({
    bottleneck: zStr(140),
    summary: zStr(600),
    metric: zStr(120).optional().nullable().catch(null),
    evidence: zEvidence,
    evidenceCount: zStr(60).optional().nullable().catch(null),
    refs: zRefs,
  }),
});
export type BrainOut = { facts: { category: string; text: string; evidence: Evidence; evidenceCount: string | null; refs: SourceRef[] }[]; diagnosis: { bottleneck: string; summary: string; metric: string | null; evidence: Evidence; evidenceCount: string | null; refs: SourceRef[] } };

export async function buildBrain(c: Ctx): Promise<{ data: BrainOut; source: GenSource }> {
  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Build this company's "Company Brain": 8-14 atomic facts a growth analyst would rely on, plus a diagnosis of the single biggest growth bottleneck.
Categories allowed: ${CATEGORIES.join(", ")}.
Each fact: one sentence, specific, falsifiable. Grade evidence honestly. evidenceCount like "12 deals" or "2 sources" when known.
Diagnosis: "bottleneck" is a short headline (e.g. "Demos stall after the first call"), "summary" 2-3 sentences with the numbers that support it, "metric" the number to watch.
JSON: {"facts":[{"category","text","evidence","evidenceCount","refs":[{"label","quote"}]}],"diagnosis":{"bottleneck","summary","metric","evidence","evidenceCount","refs":[{"label","quote"}]}}

${contextBlock(c, { excerptChars: 1800, maxExcerpts: 10 })}`,
    },
  ];
  const r = await generateJson(zBrain, messages, () => fallbackBrain(c) as unknown as z.infer<typeof zBrain>, { size: "large", maxTokens: 2600, temperature: 0.3 });
  const data: BrainOut =
    r.source === "offline"
      ? (r.data as unknown as BrainOut)
      : {
          facts: r.data.facts.map((f) => ({ category: f.category, text: f.text, evidence: f.evidence as Evidence, evidenceCount: f.evidenceCount ?? null, refs: resolveRefs(f.refs, c.excerpts) })),
          diagnosis: { ...r.data.diagnosis, metric: r.data.diagnosis.metric ?? null, evidence: r.data.diagnosis.evidence as Evidence, evidenceCount: r.data.diagnosis.evidenceCount ?? null, refs: resolveRefs(r.data.diagnosis.refs, c.excerpts) },
        };
  // Downgrade "supported" claims without any resolvable source when there is no CRM data.
  for (const f of data.facts) if (f.evidence === "supported" && !f.refs.length && c.stats.total < 5) f.evidence = "weak";
  return { data, source: r.source };
}

function refFor(c: Ctx, kind: string): SourceRef[] {
  const e = c.excerpts.find((x) => x.kind === kind);
  return e ? [{ sourceId: e.sourceId, label: e.label, kind: e.kind, quote: null }] : [];
}

function fallbackBrain(c: Ctx): BrainOut {
  const s = c.stats;
  const facts: BrainOut["facts"] = [];
  const ans = (i: number) => c.answers[i]?.a?.trim();
  if (c.site?.summary) facts.push({ category: "Product", text: clip(c.site.summary, 300), evidence: "weak", evidenceCount: "website", refs: refFor(c, "website") });
  if (c.site?.audience) facts.push({ category: "ICP", text: `The website targets ${clip(c.site.audience, 200)}.`, evidence: "weak", evidenceCount: "website", refs: refFor(c, "website") });
  if (ans(0)) facts.push({ category: "ICP", text: `Buyer: ${clip(ans(0), 260)}`, evidence: "assumed", evidenceCount: "founder", refs: refFor(c, "conversation") });
  if (ans(2)) facts.push({ category: "Competitors", text: `Main alternative when losing: ${clip(ans(2), 240)}`, evidence: "assumed", evidenceCount: "founder", refs: refFor(c, "conversation") });
  if (ans(3)) facts.push({ category: "Win/loss", text: `Customers buy because ${clip(ans(3), 240)}`, evidence: "assumed", evidenceCount: "founder", refs: refFor(c, "conversation") });
  if (ans(4)) facts.push({ category: "Channels", text: `Best lead channel: ${clip(ans(4), 200)}`, evidence: "assumed", evidenceCount: "founder", refs: refFor(c, "conversation") });
  if (c.site?.positioning) facts.push({ category: "Positioning", text: `Headline promise: “${clip(c.site.positioning, 200)}”`, evidence: "weak", evidenceCount: "website", refs: refFor(c, "website") });
  if (s.total) {
    const crm = refFor(c, "crm");
    if (s.winRate != null) facts.push({ category: "Win/loss", text: `Closed-deal win rate is ${Math.round(s.winRate * 100)}% (${s.won} won of ${s.won + s.lost}).`, evidence: s.won + s.lost >= 5 ? "supported" : "weak", evidenceCount: `${s.won + s.lost} deals`, refs: crm });
    if (s.topLossReasons[0]) facts.push({ category: "Objections", text: `Most common loss reason: ${s.topLossReasons[0].reason} (${s.topLossReasons[0].count} of ${s.lost} lost deals).`, evidence: s.topLossReasons[0].count >= 5 ? "supported" : "weak", evidenceCount: `${s.topLossReasons[0].count} deals`, refs: crm });
    if (s.medianCycleDays != null) facts.push({ category: "Win/loss", text: `Median sales cycle for won deals is ${s.medianCycleDays} days.`, evidence: s.won >= 5 ? "supported" : "weak", evidenceCount: `${s.won} won`, refs: crm });
    if (s.avgWon) facts.push({ category: "Pricing", text: `Average won deal size is ${Math.round(s.avgWon).toLocaleString("en-US")}.`, evidence: s.won >= 5 ? "supported" : "weak", evidenceCount: `${s.won} won`, refs: crm });
  }
  if (facts.length < 3) facts.push({ category: "Positioning", text: `${c.company} has not yet shared enough evidence for a confident read — add CRM exports or call notes.`, evidence: "assumed", evidenceCount: null, refs: [] });
  const top = s.topLossReasons[0];
  const diagnosis: BrainOut["diagnosis"] = top
    ? {
        bottleneck: `Deals are being lost to “${top.reason}”`,
        summary: `${top.count} of your ${s.lost} lost deals cite ${top.reason}. With a ${s.winRate != null ? Math.round(s.winRate * 100) + "%" : "low"} win rate, fixing the most common objection is the cheapest lever.`,
        metric: "Win rate on qualified deals",
        evidence: top.count >= 5 ? "supported" : "weak",
        evidenceCount: `${top.count} deals`,
        refs: refFor(c, "crm"),
      }
    : s.stalledOpen
      ? { bottleneck: "Open deals are stalling", summary: `${s.stalledOpen} open deals are older than 45 days. Pipeline is ageing rather than converting.`, metric: "Stage-to-stage conversion", evidence: "weak", evidenceCount: `${s.stalledOpen} deals`, refs: refFor(c, "crm") }
      : { bottleneck: "Not enough evidence yet", summary: "Oryn needs CRM history or call notes to find the real bottleneck. Start with what you told us and correct as evidence comes in.", metric: ans(1) ? clip(ans(1), 100) : "Qualified pipeline", evidence: "assumed", evidenceCount: null, refs: refFor(c, "conversation") };
  return { facts: facts.slice(0, 14), diagnosis };
}

/* ===================== 3. Propose bets ===================== */
const zBets = z.object({
  bets: z
    .array(
      z.object({
        title: zStr(80),
        hypothesis: zStr(320),
        metric: zStr(120),
        effort: zStr(60).catch("~1 week"),
        evidence: zEvidence,
        evidenceCount: zStr(60).optional().nullable().catch(null),
        killCriteria: zStr(160).catch(""),
        durationDays: z.coerce.number().int().min(7).max(60).catch(21),
        refs: zRefs,
      }),
    )
    .min(1)
    .transform((a) => a.slice(0, 3)),
});
export type BetProposal = { title: string; hypothesis: string; metric: string; effort: string; evidence: Evidence; evidenceCount: string | null; killCriteria: string; durationDays: number; refs: SourceRef[] };

export async function proposeBets(c: Ctx): Promise<{ data: BetProposal[]; source: GenSource }> {
  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Propose 3 time-boxed growth bets that would most move the goal. Rank by expected impact divided by effort. Do not repeat bets that were killed or that learnings contradict.
Each: "title" (≤6 words), "hypothesis" as "If <change>, then <metric> moves from X to Y" using real numbers only when known, "metric", "effort" (e.g. "~2 days"), "evidence", "evidenceCount", "killCriteria", "durationDays" (usually 21), "refs".
JSON: {"bets":[...]}

${contextBlock(c)}`,
    },
  ];
  const r = await generateJson(zBets, messages, () => ({ bets: fallbackBets(c) }) as never, { maxTokens: 1500 });
  if (r.source === "offline") return { data: fallbackBets(c), source: r.source };
  return { data: r.data.bets.map((b) => ({ ...b, evidence: b.evidence as Evidence, evidenceCount: b.evidenceCount ?? null, refs: resolveRefs(b.refs, c.excerpts) })), source: r.source };
}

function fallbackBets(c: Ctx): BetProposal[] {
  const s = c.stats;
  const crm = refFor(c, "crm");
  const out: BetProposal[] = [];
  const top = s.topLossReasons[0];
  if (top) out.push({ title: `Answer “${top.reason}” earlier`, hypothesis: `If the ${top.reason} objection is handled on the website and in the first call, fewer qualified deals are lost to it.`, metric: "Win rate on qualified deals", effort: "~3 days", evidence: top.count >= 5 ? "supported" : "weak", evidenceCount: `${top.count} lost deals`, killCriteria: "No change in loss reasons after 21 days", durationDays: 21, refs: crm });
  if (s.stalledOpen || s.open) out.push({ title: "Revive stalled pipeline", hypothesis: `If every open deal silent for 10+ days gets a specific second touch, more of the ${s.open} open deals move to the next stage.`, metric: "Open deals advancing a stage", effort: "~2 hours / week", evidence: s.open >= 5 ? "weak" : "assumed", evidenceCount: `${s.open} open deals`, killCriteria: "Fewer than 2 deals advance in 21 days", durationDays: 21, refs: crm });
  out.push({ title: "Ten customer conversations", hypothesis: "If you talk to 10 recent buyers and lost prospects, the ICP and positioning facts move from assumed to supported.", metric: "Brain facts at Supported", effort: "~5 hours", evidence: "assumed", evidenceCount: null, killCriteria: "Fewer than 6 conversations booked in 14 days", durationDays: 21, refs: [] });
  out.push({ title: "Sharpen the homepage promise", hypothesis: "If the homepage headline names the buyer and the outcome, visitor-to-demo conversion improves.", metric: "Homepage → demo request rate", effort: "~1 day", evidence: "assumed", evidenceCount: null, killCriteria: "No lift after 21 days", durationDays: 21, refs: refFor(c, "website") });
  return out.slice(0, 3);
}

/* ===================== 4. Weekly actions ===================== */
const zWeek = z.object({
  headline: zStr(160).catch("Three actions for this week"),
  actions: z
    .array(
      z.object({
        title: zStr(120),
        why: zStr(420),
        bet: zStr(80).optional().nullable().catch(null),
        effort: zStr(40).catch("~1 hour"),
        impact: zStr(10).transform((s) => (["high", "medium", "low"].includes(s.toLowerCase()) ? s.toLowerCase() : "medium")).catch("medium"),
        autonomy: z.coerce.number().int().min(1).max(2).catch(1),
        draftKind: zStr(10).transform((s) => (["email", "post", "copy", "none"].includes(s.toLowerCase()) ? s.toLowerCase() : "none")).catch("none"),
        evidence: zEvidence,
        evidenceCount: zStr(60).optional().nullable().catch(null),
        refs: zRefs,
        reasoning: z.array(zStr(220)).catch([]).transform((a) => a.slice(0, 5)),
        successMetric: zStr(160).optional().nullable().catch(null),
      }),
    )
    .min(1)
    .transform((a) => a.slice(0, 3)),
});
export type WeekAction = { title: string; why: string; bet: string | null; effort: string; impact: "high" | "medium" | "low"; autonomy: number; draftKind: string; evidence: Evidence; evidenceCount: string | null; refs: SourceRef[]; reasoning: { step: string }[]; successMetric: string | null };

export async function generateWeek(c: Ctx): Promise<{ data: { headline: string; actions: WeekAction[] }; source: GenSource }> {
  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Write this week's brief: exactly 3 actions the founder should do this week, ranked by expected impact on the goal. Each must be doable in under 2 hours, specific (who/what/where), and tied to an active bet when one fits. Learn from feedback: don't repeat skipped/disagreed actions unless evidence changed.
Fields: "title" (imperative, ≤14 words), "why" (1-2 sentences citing the evidence), "bet" (exact active bet title or null), "effort" ("~45 min"), "impact" (high|medium|low), "autonomy" (1 = recommend only, 2 = Oryn can draft it), "draftKind" (email|post|copy|none — what Oryn would draft), "evidence", "evidenceCount", "refs", "reasoning" (3-4 short steps showing how you got here), "successMetric".
JSON: {"headline": one line summary of the week, "actions":[...]}

${contextBlock(c)}`,
    },
  ];
  const r = await generateJson(zWeek, messages, () => ({ headline: "", actions: [] }) as never, { maxTokens: 2200 });
  if (r.source === "offline" || !r.data.actions?.length) return { data: fallbackWeek(c), source: "offline" };
  return {
    data: {
      headline: r.data.headline,
      actions: r.data.actions.map((a) => ({ ...a, bet: a.bet ?? null, impact: a.impact as WeekAction["impact"], evidence: a.evidence as Evidence, evidenceCount: a.evidenceCount ?? null, refs: resolveRefs(a.refs, c.excerpts), reasoning: a.reasoning.map((s) => ({ step: s })), successMetric: a.successMetric ?? null })),
    },
    source: r.source,
  };
}

export function fallbackWeek(c: Ctx): { headline: string; actions: WeekAction[] } {
  const s = c.stats;
  const crm = refFor(c, "crm");
  const active = c.bets.filter((b) => b.status === "active");
  const acts: WeekAction[] = [];
  const top = s.topLossReasons[0];
  if (s.open > 0)
    acts.push({ title: `Send a specific second touch to the ${Math.min(s.open, 6)} oldest open deals`, why: `${s.open} deals are open${s.stalledOpen ? ` and ${s.stalledOpen} are older than 45 days` : ""}. A short, specific follow-up is the cheapest way to restart them.`, bet: active.find((b) => /pipeline|stall|follow/i.test(b.title))?.title ?? null, effort: "~45 min", impact: "high", autonomy: 2, draftKind: "email", evidence: s.open >= 5 ? "weak" : "assumed", evidenceCount: `${s.open} open deals`, refs: crm, reasoning: [{ step: "Counted open deals in your CRM export" }, { step: "Ranked by age — older deals are most at risk" }, { step: "A second touch is low effort and reversible" }], successMetric: "Replies within 5 days" });
  if (top)
    acts.push({ title: `Add a section answering “${top.reason}” to your sales deck and homepage`, why: `${top.count} of ${s.lost} lost deals cite ${top.reason}. Address it before the buyer has to ask.`, bet: active[0]?.title ?? null, effort: "~1 hour", impact: "high", autonomy: 2, draftKind: "copy", evidence: top.count >= 5 ? "supported" : "weak", evidenceCount: `${top.count} deals`, refs: crm, reasoning: [{ step: "Grouped loss reasons from your CRM" }, { step: `“${top.reason}” is the most frequent` }, { step: "Objection handling earlier in the funnel is cheapest to test" }], successMetric: "Fewer losses for this reason next month" });
  acts.push({ title: "Book two 20-minute calls with customers who bought in the last 90 days", why: "Several Brain facts are still assumed. Two buyer conversations will confirm or correct who buys and why.", bet: active.find((b) => /conversation|customer|interview/i.test(b.title))?.title ?? null, effort: "~1 hour", impact: "medium", autonomy: 2, draftKind: "email", evidence: "assumed", evidenceCount: null, refs: refFor(c, "conversation"), reasoning: [{ step: "Checked which Brain facts lack evidence" }, { step: "Recent buyers remember why they bought" }], successMetric: "2 calls booked" });
  acts.push({ title: "Rewrite your homepage headline to name the buyer and the outcome", why: "The headline is the first thing every prospect reads and the cheapest thing to test.", bet: active.find((b) => /homepage|promise|position/i.test(b.title))?.title ?? null, effort: "~45 min", impact: "medium", autonomy: 2, draftKind: "copy", evidence: "assumed", evidenceCount: null, refs: refFor(c, "website"), reasoning: [{ step: "Read your current homepage" }, { step: "Compared it to the buyer described in your Brain" }], successMetric: "Homepage → demo request rate" });
  return { headline: active.length ? `Three actions tied to your ${active.length} active bet${active.length > 1 ? "s" : ""}` : "Three actions to move your goal", actions: acts.slice(0, 3) };
}

/* ===================== 5. Draft ===================== */
const zDraft = z.object({
  kind: zStr(10).transform((s) => (["email", "post", "copy"].includes(s.toLowerCase()) ? s.toLowerCase() : "email")),
  title: zStr(120),
  recipient: zStr(160).optional().nullable().catch(null),
  subject: zStr(160).optional().nullable().catch(null),
  body: zStr(4000),
  flags: z.array(z.object({ text: zStr(200), issue: zStr(240), suggestion: zStr(240).optional().nullable().catch(null) })).catch([]).transform((a) => a.slice(0, 5)),
});
export type DraftOut = { kind: string; title: string; recipient: string | null; subject: string | null; body: string; flags: { text: string; issue: string; suggestion?: string }[] };

export async function draftForAction(c: Ctx, a: { title: string; why: string; draftKind: string | null }, instruction?: string): Promise<{ data: DraftOut; source: GenSource }> {
  const v = c.voice;
  const voice = v ? `VOICE: formality ${v.formality}/100, directness ${v.directness}/100, length ${v.length}/100 (low = short), energy ${v.energy}/100. Always use: ${v.use.join(", ") || "-"}. Never use: ${v.avoid.join(", ") || "-"}.${v.samples ? `\nSAMPLES OF THE FOUNDER'S WRITING:\n${clip(v.samples, 1200)}` : ""}` : "";
  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Write the ${a.draftKind && a.draftKind !== "none" ? a.draftKind : "email"} the founder needs for this action, in the founder's voice, ready to paste. Use placeholders like [First name] for unknown names. Keep emails under 120 words. Then list "flags": any claim in your draft that is NOT supported by the provided evidence (quote the exact text, the issue, and a safer suggestion).${instruction ? `\nEXTRA INSTRUCTION FROM FOUNDER: ${clip(instruction, 400)}` : ""}
JSON: {"kind":"email|post|copy","title","recipient","subject","body","flags":[{"text","issue","suggestion"}]}

ACTION: ${a.title}
WHY: ${a.why}
${voice}

${contextBlock(c, { maxExcerpts: 5, excerptChars: 1000 })}`,
    },
  ];
  const r = await generateJson(zDraft, messages, () => fallbackDraft(c, a), { maxTokens: 1400, temperature: 0.6 });
  if (r.source === "offline") return { data: fallbackDraft(c, a), source: "offline" };
  const d = r.data;
  // Only keep flags whose quoted text is really in the body
  const flags = d.flags.filter((f) => d.body.includes(f.text)).map((f) => ({ text: f.text, issue: f.issue, suggestion: f.suggestion ?? undefined }));
  return { data: { ...d, recipient: d.recipient ?? null, subject: d.subject ?? null, flags }, source: r.source };
}

function fallbackDraft(c: Ctx, a: { title: string; why: string; draftKind: string | null }): DraftOut {
  const kind = a.draftKind && a.draftKind !== "none" ? a.draftKind : "email";
  if (kind === "copy")
    return { kind, title: a.title, recipient: null, subject: null, body: `[Headline naming your buyer and the outcome they get]\n\n${c.site?.product ? clip(c.site.product, 200) : "[One sentence on what you do]"} for ${c.site?.audience ? clip(c.site.audience, 120) : "[your buyer]"}.\n\n• [Proof point 1 — a real number from a customer]\n• [Proof point 2]\n• [Answer to the most common objection]\n\n[Primary call to action]`, flags: [] };
  if (kind === "post")
    return { kind, title: a.title, recipient: null, subject: null, body: `[One-line hook about a real result]\n\nWhat we tried:\n[...]\n\nWhat happened:\n[...]\n\nWhat we’d do differently:\n[...]\n\n— ${c.company}`, flags: [] };
  return { kind: "email", title: a.title, recipient: "[First name], [Company]", subject: "Quick follow-up", body: `Hi [First name],\n\nFollowing up on our last conversation about [their goal]. [One sentence answering the question they raised.]\n\nWould a 20-minute call next week be useful? I can show it on your own data.\n\nBest,\n[Your name]`, flags: [] };
}

/* ===================== 6. Ask Oryn ===================== */
const zAnswer = z.object({ answer: zStr(3000), refs: zRefs, followUps: z.array(zStr(120)).catch([]).transform((a) => a.slice(0, 3)) });

export async function askOryn(c: Ctx, history: { role: "user" | "assistant"; content: string }[], question: string) {
  const messages: ChatMsg[] = [
    { role: "system", content: `${SYSTEM}\nYou answer the founder's questions using only the context below. If the context doesn't contain the answer, say so plainly and suggest what evidence to add. Keep answers under 180 words; use short paragraphs or a short list.\n\n${contextBlock(c, { maxExcerpts: 8, excerptChars: 1200 })}` },
    ...history.slice(-6).map((m) => ({ role: m.role, content: clip(m.content, 1500) }) as ChatMsg),
    { role: "user", content: `${clip(question, 1500)}\n\nReply as JSON: {"answer": markdown string, "refs":[{"label","quote"}], "followUps": up to 3 short follow-up questions}` },
  ];
  const r = await generateJson(zAnswer, messages, () => ({ answer: offlineAnswer(c, question), refs: [], followUps: [] }), { maxTokens: 900 });
  return { answer: r.data.answer, refs: r.source === "offline" ? [] : resolveRefs(r.data.refs, c.excerpts), followUps: r.data.followUps, source: r.source };
}

function offlineAnswer(c: Ctx, q: string) {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const hits = c.facts.filter((f) => words.some((w) => f.text.toLowerCase().includes(w))).slice(0, 4);
  const base = hits.length ? `Here’s what your Company Brain says:\n\n${hits.map((h) => `- **${h.category}:** ${h.text} _(${h.evidence})_`).join("\n")}` : `I couldn’t find anything in your Company Brain about that yet.`;
  return `${base}\n\n${c.statsText}\n\n_The AI model isn’t reachable right now, so this answer comes straight from your saved facts._`;
}

/* ===================== 7. Learning memo ===================== */
const zMemo = z.object({ title: zStr(140), tried: zStr(600), happened: zStr(600), believe: zStr(600), changes: zStr(600), evidence: zEvidence, evidenceCount: zStr(60).optional().nullable().catch(null) });
export type Memo = { title: string; tried: string; happened: string; believe: string; changes: string; evidence: Evidence; evidenceCount: string | null };

export async function learningMemo(c: Ctx, bet: { title: string; hypothesis: string; metric: string; result: string; outcome: string }, acts: { title: string; status: string; outcome: string | null; reason?: string | null }[]): Promise<{ data: Memo; source: GenSource }> {
  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Write a learning memo for this finished bet. Be honest about what is and isn't proven. "title" is the one-sentence lesson. "tried", "happened", "believe" (what we now believe), "changes" (what Oryn and the founder will do differently) — 1-3 sentences each.
JSON: {"title","tried","happened","believe","changes","evidence","evidenceCount"}

BET: ${bet.title}
HYPOTHESIS: ${bet.hypothesis}
METRIC: ${bet.metric}
RESULT: ${bet.outcome} — founder's note: ${clip(bet.result, 800)}
ACTIONS IN THIS BET:
${acts.map((a) => `- ${a.title} → ${a.status}${a.outcome ? `: ${clip(a.outcome, 200)}` : ""}${a.reason ? ` (${clip(a.reason, 120)})` : ""}`).join("\n") || "- none recorded"}

${contextBlock(c, { maxExcerpts: 3, excerptChars: 600 })}`,
    },
  ];
  const fb = (): Memo => ({
    title: bet.outcome === "won" ? `“${bet.title}” worked` : `“${bet.title}” didn’t move ${bet.metric}`,
    tried: bet.hypothesis,
    happened: bet.result || `${acts.filter((a) => a.status === "done").length} of ${acts.length} actions were completed.`,
    believe: bet.outcome === "won" ? "This lever is worth repeating." : "This lever is weaker than expected for now.",
    changes: bet.outcome === "won" ? "Oryn will rank similar actions higher." : "Oryn will stop proposing this until new evidence appears.",
    evidence: acts.length >= 5 ? "weak" : "assumed",
    evidenceCount: `${acts.length} actions`,
  });
  const r = await generateJson(zMemo, messages, fb, { maxTokens: 900 });
  return { data: { ...r.data, evidence: r.data.evidence as Evidence, evidenceCount: r.data.evidenceCount ?? null }, source: r.source };
}

/* ===================== 8. Proposals from new evidence ===================== */
const zProps = z.object({
  proposals: z
    .array(
      z.object({
        factIndex: z.coerce.number().int().optional().nullable().catch(null),
        category: zStr(40),
        proposedText: zStr(320),
        rationale: zStr(400),
        evidence: zEvidence,
        evidenceCount: zStr(60).optional().nullable().catch(null),
        refs: zRefs,
      }),
    )
    .catch([])
    .transform((a) => a.slice(0, 4)),
});

export async function proposeUpdates(c: Ctx, fresh: Excerpt) {
  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `New evidence was added. Compare it to the current Company Brain and propose at most 3 changes: either update an existing fact (give its number as factIndex) or add a new fact (factIndex null). Only propose changes the new evidence actually supports. If nothing changes, return an empty list.
JSON: {"proposals":[{"factIndex","category","proposedText","rationale","evidence","evidenceCount","refs":[{"label","quote"}]}]}

CURRENT FACTS:
${c.facts.map((f, i) => `${i}. [${f.category}] ${f.text} (${f.evidence})`).join("\n") || "(none)"}

NEW EVIDENCE — ${fresh.label} [${fresh.kind}]:
${clip(fresh.text, 6000)}`,
    },
  ];
  const r = await generateJson(zProps, messages, () => ({ proposals: [] }), { size: "large", maxTokens: 1200 });
  return {
    data: r.data.proposals.map((p) => {
      const fact = p.factIndex != null ? c.facts[p.factIndex] : undefined;
      const refs = resolveRefs(p.refs, [fresh, ...c.excerpts]);
      return {
        factId: fact?.id ?? null,
        currentText: fact?.text ?? null,
        category: fact?.category ?? ((CATEGORIES as readonly string[]).find((k) => k.toLowerCase() === p.category.toLowerCase()) ?? "Positioning"),
        proposedText: p.proposedText,
        rationale: p.rationale,
        evidence: p.evidence as Evidence,
        evidenceCount: p.evidenceCount ?? null,
        refs: refs.length ? refs : [{ sourceId: fresh.sourceId, label: fresh.label, kind: fresh.kind, quote: null }],
      };
    }),
    source: r.source,
  };
}
