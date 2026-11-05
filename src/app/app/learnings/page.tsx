import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { schema } from "@/server/db";
import { requireActiveWorkspace } from "@/server/service";
import { ButtonLink, Card, EmptyState, EvidenceBadge, PageHeader, Stat } from "@/components/ui";
import { fmtDate } from "@/components/app/blocks";

export const metadata = { title: "Learnings" };

export default async function LearningsPage() {
  const { ws, db } = await requireActiveWorkspace();
  const [rows, versions] = await Promise.all([
    db.select().from(schema.learnings).where(eq(schema.learnings.workspaceId, ws.id)).orderBy(desc(schema.learnings.createdAt)),
    db.select({ id: schema.brainVersions.id }).from(schema.brainVersions).where(eq(schema.brainVersions.workspaceId, ws.id)),
  ]);
  return (
    <>
      <PageHeader title="Learnings" sub="What your outcomes taught Oryn. Every memo changes what it recommends next." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Memos" value={rows.length} />
        <Stat label="Agreed by you" value={rows.filter((r) => r.reaction === "agree").length} />
        <Stat label="Brain versions" value={versions.length} />
      </div>
      {!rows.length ? (
        <EmptyState title="No learnings yet" action={<ButtonLink href="/app/goals" size="sm">See your bets</ButtonLink>}>
          When you end a bet — won or killed — Oryn writes a memo on what you tried, what happened and what changes.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-border">
          {rows.map((l) => (
            <Link key={l.id} href={`/app/learnings/${l.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-canvas">
              <span className="w-16 shrink-0 text-[12.5px] text-fg-3">{fmtDate(l.createdAt)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-medium">{l.title}</span>
                <span className="block truncate text-[13px] text-fg-3">{l.believe}</span>
              </span>
              <EvidenceBadge level={l.evidence} count={l.evidenceCount} />
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
