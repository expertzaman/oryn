import Link from "next/link";
import { AgentMark, AutonomyChip, Badge, ButtonLink, EvidenceBadge, SourceChip } from "@/components/ui";

export const metadata = { title: { absolute: "Oryn — Three actions that move your growth goal, every week" } };

const STEPS = [
  { n: "01", t: "Oryn reads your company", d: "Your website, CRM exports from HubSpot, Pipedrive or Salesforce, call notes and sales decks. Read-only, nothing posted." },
  { n: "02", t: "It finds the bottleneck", d: "A diagnosis of where growth is actually stuck — with the deal counts and quotes that prove it." },
  { n: "03", t: "You get three actions", d: "Every week, the three moves with the highest expected impact on your goal. Each one shows why, the evidence and the effort." },
  { n: "04", t: "It learns from outcomes", d: "Mark actions done, skip or disagree. Oryn writes what it learned and changes next week’s plan." },
];

const FEATURES = [
  { t: "Weekly brief", d: "Three ranked actions, not a dashboard. Each one fits in under two hours.", tag: "This Week" },
  { t: "Company Brain", d: "Your ICP, positioning, objections and win/loss themes as facts — each graded Supported, Weak or Assumed.", tag: "Brain" },
  { t: "Evidence on everything", d: "Every recommendation links to the deals, documents or answers behind it. No black boxes.", tag: "Trust" },
  { t: "Bets with a time box", d: "Up to three active growth bets, each with a hypothesis, a metric and kill criteria.", tag: "Goals" },
  { t: "Drafts in your voice", d: "Follow-ups, posts and page copy written the way you write — with unsupported claims flagged.", tag: "Drafts" },
  { t: "Learnings that stick", d: "When a bet ends, Oryn writes a memo: what you tried, what happened, what changes.", tag: "Learnings" },
];

const FAQ = [
  { q: "What data does Oryn need?", a: "Your website is enough to start. For a sharp diagnosis, add a CRM export (CSV from HubSpot, Pipedrive or Salesforce), lost-deal notes or call transcripts. Oryn reads them; it never writes back to your tools." },
  { q: "Will Oryn send emails or post for me?", a: "No. On the Founder plan Oryn recommends and drafts (autonomy levels 1–2). You copy, edit and send. Nothing leaves your workspace without you." },
  { q: "How is this different from asking a chatbot?", a: "Oryn keeps a versioned Company Brain of your facts, grades the evidence for each one, tracks bets over time and learns from what you actually did. Answers are grounded in your data, with sources." },
  { q: "Which AI models do you use?", a: "Oryn runs on Llama 3.3 70B via Groq and Google Gemini, switching automatically if one is unavailable. Your data is not used to train models." },
  { q: "Can I delete my data?", a: "Yes. Export everything as JSON or Markdown from Settings, or delete your workspace and all its data in one step." },
];

function ProductPreview() {
  const actions = [
    { t: "Rewrite the homepage headline for operations leaders", why: "3 of 4 lost deals in October said the value was unclear for ops teams.", l: 2, ev: "supported" as const, c: "4 deals", src: ["Lost-deal notes", "ICP fact"], imp: "High" },
    { t: "Send a second touch to 6 demos that went quiet", why: "Stalled deals with a second touch closed twice as often in your CRM export.", l: 2, ev: "weak" as const, c: "6 deals", src: ["CRM export · 186 deals"], imp: "Medium" },
    { t: "Post one founder story about the warehouse pilot", why: "Your content bet needs two more posts before its time box ends.", l: 1, ev: "assumed" as const, c: null, src: ["Bet history"], imp: "Low" },
  ];
  return (
    <div className="relative mx-auto max-w-[1080px] text-left">
      <div aria-hidden className="pointer-events-none absolute -inset-x-10 -top-10 bottom-10 rounded-[40px] bg-sunrise opacity-[0.16] blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-canvas shadow-e4">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <span className="size-2.5 rounded-full bg-ink-200" />
          <span className="size-2.5 rounded-full bg-ink-200" />
          <span className="size-2.5 rounded-full bg-ink-200" />
          <span className="ml-3 text-[12px] text-fg-3">Example workspace · This Week</span>
        </div>
        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <div className="mb-4">
              <p className="text-[20px] font-semibold tracking-[-0.02em]">Good morning, Sam</p>
              <p className="text-[13px] text-fg-3">Week of 9 Nov · Goal: 12 qualified demos a month</p>
            </div>
            {actions.map((a, i) => (
              <div key={a.t} className="rounded-xl border border-border bg-surface p-4 shadow-e1">
                <div className="flex gap-3">
                  <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-text">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-semibold leading-snug">{a.t}</p>
                      <Badge tone={a.imp === "High" ? "brand" : "neutral"} className="hidden sm:inline-flex">{a.imp} impact</Badge>
                    </div>
                    <p className="mt-1 text-[13.5px] text-fg-2">{a.why}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <AutonomyChip level={a.l} />
                      <EvidenceBadge level={a.ev} count={a.c} />
                      {a.src.map((s) => (
                        <SourceChip key={s} label={s} kind="crm" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden space-y-3 lg:block">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="overline">Diagnosis</p>
              <p className="mt-2 text-[16px] font-semibold leading-snug tracking-[-0.01em]">Demos stall after the first call</p>
              <p className="mt-1.5 text-[13px] text-fg-2">Only 36% of first calls get a second meeting.</p>
              <div className="mt-3"><EvidenceBadge level="supported" count="38 deals" /></div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="overline">Active bets · 2 of 3</p>
              {[["Homepage for ops leaders", 43, "On track"], ["Demo follow-up cadence", 76, "Weak signal"]].map(([n, p, s]) => (
                <div key={n as string} className="mt-3">
                  <div className="flex justify-between text-[13px]"><span className="font-medium">{n}</span><span className={s === "On track" ? "text-success" : "text-warning"}>{s}</span></div>
                  <div className="mt-2 h-1.5 rounded-full bg-subtle"><div className={`h-full rounded-full ${s === "On track" ? "bg-brand" : "bg-[#e08a1e]"}`} style={{ width: `${p}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="ai-ring rounded-xl bg-surface p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold"><AgentMark size={18} /> Ask Oryn</p>
              <p className="mt-2 text-[13px] text-fg-2">“Why is the headline #1 and not the stalled demos?”</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-280px] size-[720px] -translate-x-1/2 rounded-full bg-ember-200 opacity-40 blur-[160px]" />
        <div className="relative mx-auto max-w-[1200px] px-5 pb-20 pt-20 text-center sm:px-8 sm:pt-28">
          <Badge tone="brand" className="mx-auto">Growth intelligence for B2B SaaS founders</Badge>
          <h1 className="mx-auto mt-6 max-w-[860px] text-[42px] font-semibold leading-[1.04] tracking-[-0.04em] text-fg sm:text-[64px]">
            The three moves that grow your company <span className="text-sunrise">this week</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-[620px] text-[17px] leading-relaxed text-fg-2 sm:text-[19px]">
            Oryn reads your website, CRM history and sales notes, finds where growth is stuck, and hands you three ranked actions every Monday — with the evidence behind each one.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/sign-up" size="lg" variant="primary" className="w-full sm:w-auto">
              Start free
            </ButtonLink>
            <ButtonLink href="/#how" size="lg" variant="secondary" className="w-full sm:w-auto">
              See how it works
            </ButtonLink>
          </div>
          <p className="mt-4 text-[13px] text-fg-3">No card needed · First brief in about 5 minutes</p>
          <div className="mt-16">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Works with */}
      <section className="border-y border-border bg-canvas">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-6 text-[14px] text-fg-3 sm:px-8">
          <span className="font-medium text-fg-2">Reads what you already have:</span>
          {["Your website", "HubSpot export", "Pipedrive export", "Salesforce export", "PDF decks", "Call notes"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="overline !text-brand-text">The problem</p>
            <h2 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">You have dashboards. You don’t have decisions.</h2>
            <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-fg-2">
              Founders sit on years of CRM history, call notes and lost-deal reasons — and still decide the week by gut feel. The evidence exists. Nobody has time to read it.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Before", "Ten tabs, three dashboards, and a Monday spent deciding what to do."],
              ["With Oryn", "Three actions, ranked, each one linked to the deals that prove it."],
              ["Before", "“Why did we lose?” lives in someone’s head."],
              ["With Oryn", "Loss reasons become graded facts in your Company Brain."],
            ].map(([k, v], i) => (
              <div key={i} className={`rounded-xl border p-5 ${k === "With Oryn" ? "border-brand-border bg-brand-soft" : "border-border bg-surface"}`}>
                <p className={`text-[12px] font-semibold uppercase tracking-[0.08em] ${k === "With Oryn" ? "text-brand-text" : "text-fg-3"}`}>{k}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-fg">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="scroll-mt-20 bg-ink-900 text-white">
        <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8">
          <p className="overline !text-ember-300">How it works</p>
          <h2 className="mt-3 max-w-[640px] text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">From scattered evidence to a clear week.</h2>
          <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <span className="num text-[13px] font-semibold text-ember-300">{s.n}</span>
                <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">{s.t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-300">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section id="product" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-24 sm:px-8">
        <div className="max-w-[640px]">
          <p className="overline !text-brand-text">Product</p>
          <h2 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">Everything grounded in your own data.</h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-xl border border-border bg-surface p-6 shadow-e1 transition-shadow hover:shadow-e2">
              <Badge>{f.tag}</Badge>
              <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">{f.t}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Control */}
      <section className="border-y border-border bg-canvas">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="overline !text-brand-text">You stay in control</p>
            <h2 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">Autonomy is earned, not assumed.</h2>
            <p className="mt-5 max-w-[500px] text-[17px] leading-relaxed text-fg-2">
              Oryn starts by recommending. It drafts when you ask. You decide every level, area by area — and one switch pauses everything.
            </p>
          </div>
          <div className="space-y-2.5">
            {[
              [0, "Observe", "Oryn only learns from your data.", "available"],
              [1, "Recommend", "Three ranked actions each week, with evidence.", "current"],
              [2, "Draft", "Emails, posts and page copy for you to send.", "available"],
              [3, "Approve & run", "One-click execution with undo — Platform plan.", "locked"],
            ].map(([l, n, d, s]) => (
              <div key={l as number} className={`flex items-center gap-4 rounded-xl border p-4 ${s === "current" ? "border-brand-border bg-surface shadow-e2" : "border-border bg-surface"}`}>
                <AutonomyChip level={l as number} state={s as "current" | "available" | "locked"} />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{n}</p>
                  <p className="text-[13.5px] text-fg-3">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[860px] px-5 py-24 sm:px-8">
        <h2 className="text-center text-[34px] font-semibold tracking-[-0.03em]">Questions founders ask</h2>
        <div className="mt-10 divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium">
                {f.q}
                <span aria-hidden className="text-fg-3 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-fg-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24 sm:px-8">
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-2xl bg-ink-900 px-6 py-16 text-center text-white sm:px-12">
          <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-brand opacity-30 blur-[140px]" />
          <div className="relative">
            <AgentMark size={48} className="mx-auto" />
            <h2 className="mx-auto mt-6 max-w-[620px] text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">Get your first brief before lunch.</h2>
            <p className="mx-auto mt-4 max-w-[480px] text-[16px] text-ink-300">Connect your website, drop in a CRM export, answer five questions.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/sign-up" size="lg" variant="brand">Start free</ButtonLink>
              <Link href="/sign-in" className="inline-flex h-12 items-center justify-center rounded-lg border border-white/20 px-5 text-[15px] font-medium text-white hover:bg-white/10">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
