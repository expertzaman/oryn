import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { schema } from "@/server/db";
import { isPaused, requireActiveWorkspace } from "@/server/service";
import { Badge, Card, EmptyState, EvidenceBadge, PageHeader, Progress, SectionHeader, Stat } from "@/components/ui";
import { BetMini, fmtDate } from "@/components/app/blocks";
import { GoalEditor, NewBetButton, ProposeBetsButton, ProposedBetActions } from "./client";

export const metadata = { title: "Goals & Bets" };

export default async function GoalsPage() {
  const { ws, db } = await requireActiveWorkspace();
  const [goals, bets] = await Promise.all([
    db.select().from(schema.goals).where(and(eq(schema.goals.workspaceId, ws.id), eq(schema.goals.status, "active"))).limit(1),
    db.select().from(schema.bets).where(eq(schema.bets.workspaceId, ws.id)).orderBy(desc(schema.bets.createdAt)),
  ]);
  const g = goals[0] ?? null;
  const active = bets.filter((b) => b.status === "active" || b.status === "paused");
  const proposed = bets.filter((b) => b.status === "proposed");
  const past = bets.filter((b) => b.status === "won" || b.status === "killed");
  const activeCount = bets.filter((b) => b.status === "active").length;
  const pct = g && g.target != null && g.current != null && g.target !== (g.baseline ?? 0) ? ((g.current - (g.baseline ?? 0)) / (g.target - (g.baseline ?? 0))) * 100 : null;
  const paused = isPaused(ws);
  return (
    <>
      <PageHeader title="Goals & Bets" sub="One goal, up to three bets. Every weekly action traces back here." right={<><NewBetButton activeCount={activeCount} activeBets={active.filter((b) => b.status === "active").map((b) => ({ id: b.id, title: b.title }))} /><ProposeBetsButton disabled={paused} /></>} />

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="overline !text-brand-text">Primary goal</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">{g?.title ?? "No goal set"}</h2>
            {g ? <p className="mt-1 text-[13.5px] text-fg-3">Set {fmtDate(g.createdAt)}{g.dueDate ? ` · due ${fmtDate(g.dueDate, { day: "numeric", month: "short", year: "numeric" })}` : ""}</p> : null}
          </div>
          <GoalEditor goal={g ? { id: g.id, title: g.title, metric: g.metric, baseline: g.baseline, target: g.target, current: g.current, unit: g.unit, dueDate: g.dueDate } : null} />
        </div>
        {g ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Metric" value={<span className="text-[16px]">{g.metric}</span>} />
            <Stat label="Current" value={`${g.current ?? "—"}${g.unit ? ` ${g.unit}` : ""}`} sub={g.baseline != null ? `Started at ${g.baseline}` : undefined} />
            <Stat label="Target" value={g.target != null ? `${g.target}${g.unit ? ` ${g.unit}` : ""}` : "—"} sub={pct != null ? `${Math.max(0, Math.round(pct))}% of the way` : undefined} tone="brand" />
          </div>
        ) : null}
        {pct != null ? <Progress value={pct} className="mt-4" label="Goal progress" /> : null}
      </Card>

      <section className="mt-8 space-y-3">
        <SectionHeader title={`Active bets · ${activeCount} of 3`} sub="Paused bets keep their data and remaining time." />
        {active.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((b) => (
              <BetMini key={b.id} b={b} />
            ))}
          </div>
        ) : (
          <EmptyState title="No active bets">Start one of Oryn’s proposals below, or write your own.</EmptyState>
        )}
      </section>

      {proposed.length ? (
        <section className="mt-8 space-y-3">
          <SectionHeader title="Proposed by Oryn" sub="Ranked by expected impact ÷ effort" />
          <div className="grid gap-4 lg:grid-cols-3">
            {proposed.map((b, i) => (
              <Card key={b.id} className={`flex flex-col p-5 ${i === 0 ? "border-brand-border" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="num grid size-7 place-items-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-text">{i + 1}</span>
                  {i === 0 ? <Badge tone="brand">Recommended</Badge> : null}
                </div>
                <h3 className="mt-3 text-[16px] font-semibold leading-snug">{b.title}</h3>
                <p className="mt-1.5 text-[14px] text-fg-2">{b.hypothesis}</p>
                <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-[13px]">
                  <div className="flex justify-between gap-3"><dt className="text-fg-3">Measures</dt><dd className="text-right font-medium">{b.metric}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-fg-3">Effort</dt><dd className="font-medium">{b.effort ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-fg-3">Time box</dt><dd className="font-medium">{b.durationDays} days</dd></div>
                </dl>
                <div className="mt-3"><EvidenceBadge level={b.evidence} count={b.evidenceCount} /></div>
                <div className="mt-auto pt-5">
                  <ProposedBetActions id={b.id} activeCount={activeCount} activeBets={active.filter((x) => x.status === "active").map((x) => ({ id: x.id, title: x.title }))} />
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8 space-y-3">
        <SectionHeader title="Past bets" />
        {past.length ? (
          <Card className="divide-y divide-border">
            {past.map((b) => (
              <Link key={b.id} href={`/app/bets/${b.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-canvas">
                <span className="min-w-0 flex-1 text-[14.5px] font-medium">{b.title}</span>
                <span className="hidden max-w-[420px] truncate text-[13px] text-fg-3 md:block">{b.resultNote}</span>
                <Badge tone={b.status === "won" ? "success" : "danger"}>{b.status === "won" ? "Won" : "Killed"}</Badge>
              </Link>
            ))}
          </Card>
        ) : (
          <p className="text-[14px] text-fg-3">Finished bets appear here with what you learned.</p>
        )}
      </section>
    </>
  );
}
