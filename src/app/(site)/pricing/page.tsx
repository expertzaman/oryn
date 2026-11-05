import { Badge, ButtonLink } from "@/components/ui";

export const metadata = { title: "Pricing" };

const PLANS = [
  {
    name: "Founder",
    price: "$0",
    per: "during early access",
    desc: "Everything a founder needs to run the week on evidence.",
    cta: { label: "Start free", href: "/sign-up" },
    current: true,
    features: ["Weekly brief · 3 ranked actions", "Company Brain with evidence grading", "Up to 3 active bets", "Drafts in your voice", "Ask Oryn about your data", "Learning memos and activity log", "Autonomy levels L0–L2"],
  },
  {
    name: "Platform",
    price: "Coming soon",
    per: "",
    desc: "For teams ready to let Oryn execute — with approvals and undo.",
    cta: { label: "Join with Founder", href: "/sign-up" },
    features: ["Everything in Founder", "Approve & run with pre-flight checks", "Execution queue with 10-minute undo", "Earned autonomy per area (L3–L5)", "Team roles and approvers", "Playbooks and benchmarks"],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-5 py-20 sm:px-8 sm:py-28">
      <div className="text-center">
        <p className="overline !text-brand-text">Pricing</p>
        <h1 className="mt-3 text-[40px] font-semibold tracking-[-0.035em] sm:text-[52px]">Simple while we’re early.</h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[17px] text-fg-2">The Founder plan is free during early access. You’ll get 30 days’ notice before any change.</p>
      </div>
      <div className="mt-14 grid gap-5 md:grid-cols-2">
        {PLANS.map((p) => (
          <div key={p.name} className={`flex flex-col rounded-2xl border bg-surface p-7 ${p.current ? "border-brand-border shadow-e3" : "border-border shadow-e1"}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-semibold">{p.name}</h2>
              {p.current ? <Badge tone="brand">Available now</Badge> : <Badge>In development</Badge>}
            </div>
            <p className="mt-5 flex items-baseline gap-2">
              <span className="num text-[38px] font-semibold tracking-[-0.03em]">{p.price}</span>
              {p.per ? <span className="text-[14px] text-fg-3">{p.per}</span> : null}
            </p>
            <p className="mt-2 text-[15px] text-fg-2">{p.desc}</p>
            <ul className="mt-6 space-y-3 border-t border-border pt-6">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[14.5px]">
                  <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-soft text-[11px] text-success">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-8">
              <ButtonLink href={p.cta.href} variant={p.current ? "primary" : "secondary"} size="lg" className="w-full">
                {p.cta.label}
              </ButtonLink>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
