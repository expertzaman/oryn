import { and, desc, eq, ne } from "drizzle-orm";
import { schema } from "@/server/db";
import { requireActiveWorkspace } from "@/server/service";
import { Badge, Card, EmptyState, EvidenceBadge, PageHeader, SourceChip, ButtonLink } from "@/components/ui";
import { fmtDate } from "@/components/app/blocks";
import { ProposalActions } from "../client";

export const metadata = { title: "Brain proposals" };

export default async function ProposalsPage() {
  const { ws, db } = await requireActiveWorkspace();
  const [pending, decided] = await Promise.all([
    db.select().from(schema.proposals).where(and(eq(schema.proposals.workspaceId, ws.id), eq(schema.proposals.status, "pending"))).orderBy(schema.proposals.createdAt),
    db.select().from(schema.proposals).where(and(eq(schema.proposals.workspaceId, ws.id), ne(schema.proposals.status, "pending"))).orderBy(desc(schema.proposals.decidedAt)).limit(10),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/app/brain", label: "Company Brain" }} title={pending.length ? `Review ${pending.length} proposal${pending.length > 1 ? "s" : ""}` : "Proposals"} sub="Changes Oryn suggests from new evidence. Accepting creates a new Brain version." />
      {!pending.length ? (
        <EmptyState title="Nothing to review" action={<ButtonLink href="/app/settings/data" variant="secondary" size="sm">Add evidence</ButtonLink>}>New proposals appear when you add sources or Oryn re-reads your data.</EmptyState>
      ) : (
        <div className="space-y-4">
          {pending.map((p, i) => (
            <Card key={p.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="overline !text-brand-text">Proposal {i + 1} of {pending.length} · {p.category} · {p.kind === "update" ? "Update" : "New fact"}</p>
                <EvidenceBadge level={p.evidence} count={p.evidenceCount} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {p.currentText ? (
                  <div className="rounded-lg bg-canvas p-4">
                    <p className="overline">Current</p>
                    <p className="mt-1.5 text-[14.5px] text-fg-2">{p.currentText}</p>
                  </div>
                ) : null}
                <div className={`rounded-lg border border-brand-border bg-brand-soft p-4 ${p.currentText ? "" : "md:col-span-2"}`}>
                  <p className="overline !text-brand-text">Proposed</p>
                  <p className="mt-1.5 text-[15px] font-medium">{p.proposedText}</p>
                </div>
              </div>
              <p className="mt-4 text-[14px] text-fg-2"><span className="font-medium text-fg">Why: </span>{p.rationale}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                {p.refs.map((r, j) => <SourceChip key={j} label={r.label} kind={r.kind} />)}
                <span className="flex-1" />
                <ProposalActions id={p.id} proposedText={p.proposedText} />
              </div>
            </Card>
          ))}
        </div>
      )}
      {decided.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-[15px] font-semibold">Recently decided</h2>
          <Card className="divide-y divide-border">
            {decided.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 truncate text-[14px]">{p.proposedText}</span>
                <span className="text-[12.5px] text-fg-3">{fmtDate(p.decidedAt)}</span>
                <Badge tone={p.status === "accepted" ? "success" : "neutral"}>{p.status === "accepted" ? "Accepted" : "Rejected"}</Badge>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  );
}
