import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/server/db";
import { requireActiveWorkspace } from "@/server/service";
import { Badge, Card, EmptyState, EvidenceBadge, PageHeader, Progress, SourceChip } from "@/components/ui";
import { RailCard, fmtDate } from "@/components/app/blocks";
import { BetControls } from "./controls";

export const metadata = { title: "Bet" };

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" | "danger" | "brand" }> = {
  active: { label: "Running", tone: "success" },
  paused: { label: "Paused", tone: "neutral" },
  proposed: { label: "Proposed", tone: "brand" },
  won: { label: "Won", tone: "success" },
  killed: { label: "Killed", tone: "danger" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

export default async function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { ws, db } = await requireActiveWorkspace();
  const [b] = await db.select().from(schema.bets).where(and(eq(schema.bets.id, id), eq(schema.bets.workspaceId, ws.id)));
  if (!b) notFound();
  const [acts, [learning], active] = await Promise.all([
    db.select().from(schema.actions).where(eq(schema.actions.betId, id)).orderBy(desc(schema.actions.createdAt)),
    db.select({ id: schema.learnings.id, title: schema.learnings.title }).from(schema.learnings).where(eq(schema.learnings.betId, id)).limit(1),
    db.select({ id: schema.bets.id, title: schema.bets.title }).from(schema.bets).where(and(eq(schema.bets.workspaceId, ws.id), eq(schema.bets.status, "active"))),
  ]);
  const day = b.startedAt ? Math.min(b.durationDays, Math.max(1, Math.floor(((b.endedAt ?? new Date()).getTime() - b.startedAt.getTime()) / 864e5) + 1)) : 0;
  const over = b.status === "active" && b.endsAt && b.endsAt.getTime() < Date.now();
  const st = STATUS[b.status] ?? STATUS.proposed;
  const done = acts.filter((a) => a.status === "done").length;
  return (
    <>
      <PageHeader back={{ href: "/app/goals", label: "Goals & Bets" }} title={<span className="inline-flex flex-wrap items-center gap-3">{b.title} <Badge tone={st.tone}>{st.label}</Badge></span>} />
      {over ? <div className="mb-5 rounded-lg border border-[#f4dfb8] bg-warning-soft px-4 py-3 text-[14px] text-warning">The time box ended {fmtDate(b.endsAt)}. Decide: close it as won, kill it, or extend it.</div> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-6">
            <p className="overline !text-brand-text">Hypothesis</p>
            <p className="mt-2.5 text-[19px] font-medium leading-snug tracking-[-0.01em]">{b.hypothesis}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <EvidenceBadge level={b.evidence} count={b.evidenceCount} />
              {b.refs.map((r, i) => <SourceChip key={i} label={r.label} kind={r.kind} />)}
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold">Time box · {b.durationDays} days</p>
              <p className="num text-[13px] text-fg-3">{b.startedAt ? `Day ${day} of ${b.durationDays}` : "Not started"}</p>
            </div>
            <Progress value={b.startedAt ? (day / b.durationDays) * 100 : 0} className="mt-3" tone={over ? "warning" : "brand"} label="Time box" />
            <div className="mt-2 flex justify-between text-[12.5px] text-fg-3">
              <span>{b.startedAt ? `Started ${fmtDate(b.startedAt)}` : ""}</span>
              <span>{b.endsAt ? `${b.endedAt ? "Ended" : "Ends"} ${fmtDate(b.endedAt ?? b.endsAt)}` : ""}</span>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4">
              <p className="text-[15px] font-semibold">Actions in this bet</p>
              <p className="num text-[13px] text-fg-3">{done} of {acts.length} done</p>
            </div>
            {acts.length ? (
              <ul className="divide-y divide-border border-t border-border">
                {acts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/app/actions/${a.id}`} className="flex items-center gap-3 px-6 py-3.5 hover:bg-canvas">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{a.title}</span>
                        {a.outcome ? <span className="block truncate text-[12.5px] text-fg-3">{a.outcome}</span> : null}
                      </span>
                      <span className="text-[12.5px] text-fg-3">{fmtDate(a.createdAt)}</span>
                      <Badge tone={a.status === "done" ? "success" : a.status === "open" ? "brand" : "neutral"}>{a.status === "open" ? "Open" : a.status === "done" ? "Done" : a.status === "skipped" ? "Skipped" : "Disagreed"}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border-t border-border p-6"><EmptyState title="No actions yet">Oryn links weekly actions to this bet when they fit.</EmptyState></div>
            )}
          </Card>
          {b.resultNote ? (
            <Card className="p-6">
              <p className="text-[15px] font-semibold">Result</p>
              <p className="mt-2 text-[14.5px] text-fg-2">{b.resultNote}</p>
              {learning ? <Link href={`/app/learnings/${learning.id}`} className="mt-3 inline-block text-[13.5px] font-medium text-brand-text hover:underline">Read the learning memo →</Link> : null}
            </Card>
          ) : null}
        </div>
        <aside className="space-y-4">
          <RailCard title="Decide">
            <BetControls id={b.id} status={b.status} activeBets={active.filter((x) => x.id !== b.id)} />
          </RailCard>
          <RailCard title="Details">
            <dl className="space-y-2 text-[13px]">
              {[["Metric", b.metric], ["Effort", b.effort ?? "—"], ["Stop if", b.killCriteria || "—"], ["Created", fmtDate(b.createdAt, { day: "numeric", month: "short", year: "numeric" })]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt className="shrink-0 text-fg-3">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
          </RailCard>
        </aside>
      </div>
    </>
  );
}
