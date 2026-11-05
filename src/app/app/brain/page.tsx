import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { schema } from "@/server/db";
import { isPaused, requireActiveWorkspace } from "@/server/service";
import { CATEGORIES } from "@/server/ai/tasks";
import { ButtonLink, Card, EmptyState, EvidenceBadge, PageHeader, Progress, SourceChip } from "@/components/ui";
import { RailCard, fmtDate } from "@/components/app/blocks";
import { AddFactButton, FactActions, RebuildButton } from "./client";

export const metadata = { title: "Company Brain" };

export default async function BrainPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const { c, q } = await searchParams;
  const { ws, db } = await requireActiveWorkspace();
  const [facts, [{ n: pending }]] = await Promise.all([
    db.select().from(schema.facts).where(eq(schema.facts.workspaceId, ws.id)).orderBy(schema.facts.category, schema.facts.createdAt),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.proposals).where(and(eq(schema.proposals.workspaceId, ws.id), eq(schema.proposals.status, "pending"))),
  ]);
  const cats = [...new Set([...CATEGORIES, ...facts.map((f) => f.category)])].filter((k) => facts.some((f) => f.category === k));
  const query = (q ?? "").trim().toLowerCase().slice(0, 100);
  const shown = facts.filter((f) => (!c || f.category === c) && (!query || f.text.toLowerCase().includes(query)));
  const supported = facts.filter((f) => f.evidence === "supported").length;
  const weak = facts.filter((f) => f.evidence === "weak").length;
  const health = facts.length ? Math.round(((supported + weak * 0.5) / facts.length) * 100) : 0;
  const grouped = cats.map((k) => ({ k, items: shown.filter((f) => f.category === k) })).filter((g) => g.items.length);

  return (
    <>
      <PageHeader
        title="Company Brain"
        sub="Everything Oryn believes about your company — each fact graded and linked to its evidence."
        right={
          <>
            <ButtonLink href="/app/brain/versions" variant="ghost" size="sm">History</ButtonLink>
            <RebuildButton disabled={isPaused(ws)} />
            <AddFactButton categories={[...CATEGORIES]} />
          </>
        }
      />
      {Number(pending) > 0 ? (
        <Card className="mb-6 flex flex-wrap items-center gap-4 border-brand-border bg-brand-soft p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold">{pending} proposal{Number(pending) > 1 ? "s" : ""} from new evidence</p>
            <p className="text-[13px] text-fg-2">Oryn never changes your Brain without your decision.</p>
          </div>
          <ButtonLink href="/app/brain/proposals" variant="brand" size="sm">Review</ButtonLink>
        </Card>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)_280px]">
        <nav aria-label="Categories" className="lg:sticky lg:top-6 lg:self-start">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            <Link href="/app/brain" className={`flex shrink-0 justify-between gap-4 rounded-md px-3 py-2 text-[13.5px] ${!c ? "bg-brand-soft font-medium text-brand-text" : "text-fg-2 hover:bg-subtle"}`}>
              All <span className="num text-fg-3">{facts.length}</span>
            </Link>
            {cats.map((k) => (
              <Link key={k} href={`/app/brain?c=${encodeURIComponent(k)}`} className={`flex shrink-0 justify-between gap-4 rounded-md px-3 py-2 text-[13.5px] ${c === k ? "bg-brand-soft font-medium text-brand-text" : "text-fg-2 hover:bg-subtle"}`}>
                {k} <span className="num text-fg-3">{facts.filter((f) => f.category === k).length}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          <form className="flex gap-2" role="search">
            {c ? <input type="hidden" name="c" value={c} /> : null}
            <input name="q" defaultValue={q} placeholder="Search facts…" aria-label="Search facts" className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-[14px] outline-none focus:border-brand focus:shadow-focus" />
          </form>
          {!facts.length ? (
            <EmptyState title="Your Brain is empty" action={<RebuildButton label="Build from sources" />}>Add evidence in Settings → Data sources, then let Oryn read it.</EmptyState>
          ) : !grouped.length ? (
            <EmptyState title="No facts match">Try a different search or category.</EmptyState>
          ) : (
            grouped.map((g) => (
              <section key={g.k}>
                <h2 className="mb-2.5 text-[15px] font-semibold">{g.k}</h2>
                <ul className="space-y-2.5">
                  {g.items.map((f) => (
                    <li key={f.id}>
                      <Card className="p-4">
                        <div className="flex items-start gap-3">
                          <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug">{f.text}</p>
                          <EvidenceBadge level={f.evidence} count={f.evidenceCount} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {f.refs.slice(0, 3).map((r, i) => <SourceChip key={i} label={r.label} kind={r.kind} />)}
                          <span className="flex-1" />
                          <span className="text-[12px] text-fg-3">{f.confirmed ? "Confirmed by you · " : ""}{fmtDate(f.updatedAt)}</span>
                          <FactActions fact={{ id: f.id, category: f.category, text: f.text, evidence: f.evidence }} categories={[...CATEGORIES]} />
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <aside className="space-y-4">
          {ws.diagnosis ? (
            <RailCard title="Bottleneck">
              <p className="text-[15px] font-semibold leading-snug">{ws.diagnosis.bottleneck}</p>
              <p className="mt-1.5 text-[13px] text-fg-2">{ws.diagnosis.summary}</p>
              <div className="mt-2.5"><EvidenceBadge level={ws.diagnosis.evidence} count={ws.diagnosis.evidenceCount} /></div>
            </RailCard>
          ) : null}
          <RailCard title="Brain health" sub={`${facts.length} facts · ${supported} supported · ${weak} weak`}>
            <Progress value={health} tone={health > 60 ? "success" : "brand"} label="Brain health" />
            <p className="mt-2 text-[12.5px] text-fg-3">Add CRM exports and call notes to move Assumed facts to Supported.</p>
          </RailCard>
          <RailCard title={`Version ${ws.brainVersion}`}>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/app/brain/versions" size="sm" variant="secondary">History</ButtonLink>
              <a href="/app/brain/export?format=md" className="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-fg-2 hover:bg-subtle">Export .md</a>
              <a href="/app/brain/export?format=json" className="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-fg-2 hover:bg-subtle">.json</a>
            </div>
          </RailCard>
        </aside>
      </div>
    </>
  );
}
