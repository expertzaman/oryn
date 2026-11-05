import { desc, eq, sql } from "drizzle-orm";
import { schema } from "@/server/db";
import { requireActiveWorkspace } from "@/server/service";
import { Card, SourceChip } from "@/components/ui";
import { fmtDate } from "@/components/app/blocks";
import { EvidenceUploader } from "@/app/onboarding/steps";
import { RemoveSource, RereadWebsite } from "./client";

export const metadata = { title: "Data sources" };

export default async function DataPage() {
  const { ws, db } = await requireActiveWorkspace();
  const [srcs, counts] = await Promise.all([
    db.select({ id: schema.sources.id, title: schema.sources.title, kind: schema.sources.kind, createdAt: schema.sources.createdAt, chars: sql<number>`length(${schema.sources.content})::int` }).from(schema.sources).where(eq(schema.sources.workspaceId, ws.id)).orderBy(desc(schema.sources.createdAt)),
    db.select({ sourceId: schema.deals.sourceId, n: sql<number>`count(*)::int` }).from(schema.deals).where(eq(schema.deals.workspaceId, ws.id)).groupBy(schema.deals.sourceId),
  ]);
  const dealCount = new Map(counts.map((c) => [c.sourceId, Number(c.n)]));
  const label: Record<string, string> = { website: "Website", conversation: "Interview", crm: "CRM export", document: "Document", notes: "Notes" };
  return (
    <>
      <Card className="p-6">
        <h2 className="text-[16px] font-semibold">Add evidence</h2>
        <p className="mb-5 mt-1 text-[13.5px] text-fg-3">New sources are compared to your Company Brain. Oryn proposes changes; you decide.</p>
        <EvidenceUploader />
      </Card>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h2 className="text-[16px] font-semibold">Sources · {srcs.length}</h2>
            <p className="text-[13px] text-fg-3">Read-only. Removing a source also removes deals imported from it.</p>
          </div>
          {ws.website ? <RereadWebsite website={ws.website} /> : null}
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {srcs.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
              <SourceChip label={label[s.kind] ?? s.kind} kind={s.kind} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{s.title}</span>
                <span className="block text-[12.5px] text-fg-3">
                  Added {fmtDate(s.createdAt, { day: "numeric", month: "short", year: "numeric" })} · {s.kind === "crm" ? `${(dealCount.get(s.id) ?? 0).toLocaleString("en-US")} deals` : `${Math.max(1, Math.round(Number(s.chars) / 1000))}k characters`}
                </span>
              </span>
              {s.kind !== "website" && s.kind !== "conversation" ? <RemoveSource id={s.id} title={s.title} /> : null}
            </li>
          ))}
          {!srcs.length ? <li className="px-6 py-6 text-[14px] text-fg-3">No sources yet.</li> : null}
        </ul>
      </Card>
    </>
  );
}
