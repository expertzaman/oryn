import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/server/db";
import { isPaused, requireActiveWorkspace } from "@/server/service";
import { AutonomyChip, Badge, ButtonLink, Card, EvidenceBadge, PageHeader, SourceChip } from "@/components/ui";
import { BetMini, RailCard, fmtDate } from "@/components/app/blocks";
import { ActionControls } from "@/components/app/action-controls";
import { OutcomeForm } from "./outcome";

export const metadata = { title: "Action" };

export default async function ActionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { ws, db } = await requireActiveWorkspace();
  const [a] = await db.select().from(schema.actions).where(and(eq(schema.actions.id, id), eq(schema.actions.workspaceId, ws.id)));
  if (!a) notFound();
  const [[bet], [draft], [week]] = await Promise.all([
    a.betId ? db.select().from(schema.bets).where(eq(schema.bets.id, a.betId)) : Promise.resolve([]),
    db.select({ id: schema.drafts.id }).from(schema.drafts).where(eq(schema.drafts.actionId, a.id)).limit(1),
    db.select().from(schema.weeks).where(eq(schema.weeks.id, a.weekId)),
  ]);
  return (
    <>
      <PageHeader
        back={{ href: "/app", label: "This Week" }}
        title={a.title}
        sub={week ? `Action ${a.rank} · week of ${fmtDate(week.weekStart, { day: "numeric", month: "long" })}` : undefined}
        right={<ButtonLink href={`/app/ask?q=${encodeURIComponent(`Why is “${a.title}” on my list this week?`)}`} variant="ai" size="sm">Ask about this</ButtonLink>}
      />
      <div className="-mt-2 mb-6 flex flex-wrap gap-1.5">
        <AutonomyChip level={a.autonomy} />
        <EvidenceBadge level={a.evidence} count={a.evidenceCount} />
        <Badge tone={a.impact === "high" ? "brand" : "neutral"}>{a.impact} impact</Badge>
        {a.effort ? <Badge>{a.effort}</Badge> : null}
        {a.status !== "open" ? <Badge tone={a.status === "done" ? "success" : a.status === "disagreed" ? "warning" : "neutral"}>{a.status === "done" ? "Done" : a.status === "skipped" ? "Skipped" : "You disagreed"}</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-6">
            <p className="overline !text-brand-text">Why Oryn recommends this</p>
            <p className="mt-2.5 text-[16px] leading-relaxed">{a.why}</p>
            {a.reasoning.length ? (
              <ol className="mt-5 space-y-3 border-t border-border pt-5">
                {a.reasoning.map((r, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-subtle text-[12px] font-semibold text-fg-2">{i + 1}</span>
                    <span className="pt-0.5 text-[14.5px] text-fg-2">{r.step}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold">Evidence</p>
              <EvidenceBadge level={a.evidence} count={a.evidenceCount} />
            </div>
            {a.refs.length ? (
              <ul className="mt-4 divide-y divide-border">
                {a.refs.map((r, i) => (
                  <li key={i} className="py-3">
                    <SourceChip label={r.label} kind={r.kind} />
                    {r.quote ? <p className="mt-2 border-l-2 border-brand-border pl-3 text-[14px] text-fg-2">“{r.quote}”</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[14px] text-fg-3">No direct source — this recommendation is based on general patterns. Treat it as an assumption to test.</p>
            )}
            <Link href="/app/settings/data" className="mt-3 inline-block text-[13px] font-medium text-brand-text hover:underline">Add evidence →</Link>
          </Card>

          <Card className="p-6">
            <p className="text-[15px] font-semibold">Outcome</p>
            <p className="mt-1 text-[13.5px] text-fg-3">{a.successMetric ? `How you’ll know it worked: ${a.successMetric}` : "Record what happened so Oryn can learn."}</p>
            <OutcomeForm id={a.id} initial={a.outcome ?? ""} />
            {a.feedback?.reason ? <p className="mt-4 rounded-md bg-subtle px-3 py-2 text-[13.5px] text-fg-2">Your feedback: <strong>{a.feedback.reason}</strong>{a.feedback.note ? ` — ${a.feedback.note}` : ""}</p> : null}
          </Card>
        </div>

        <aside className="space-y-4">
          <RailCard title="Decide">
            <ActionControls id={a.id} status={a.status} draftKind={a.draftKind} draftId={draft?.id} compact paused={isPaused(ws)} />
          </RailCard>
          {bet ? (
            <RailCard title="Part of bet">
              <BetMini b={bet} />
            </RailCard>
          ) : null}
          <RailCard title="Autonomy" sub="For this kind of action">
            <div className="flex flex-wrap gap-1.5">
              <AutonomyChip level={0} state="available" />
              <AutonomyChip level={1} state={a.autonomy === 1 ? "current" : "available"} />
              <AutonomyChip level={2} state={a.autonomy === 2 ? "current" : "available"} />
              <AutonomyChip level={3} state="locked" />
            </div>
            <p className="mt-3 text-[12.5px] text-fg-3">L1 recommends, L2 drafts for you to send. Execution (L3+) arrives with the Platform plan.</p>
          </RailCard>
        </aside>
      </div>
    </>
  );
}
