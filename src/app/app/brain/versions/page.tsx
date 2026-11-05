import { desc, eq } from "drizzle-orm";
import { schema } from "@/server/db";
import { requireActiveWorkspace } from "@/server/service";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { fmtDate } from "@/components/app/blocks";
import { RestoreButton } from "../client";

export const metadata = { title: "Brain history" };

export default async function VersionsPage() {
  const { ws, db } = await requireActiveWorkspace();
  const versions = await db.select().from(schema.brainVersions).where(eq(schema.brainVersions.workspaceId, ws.id)).orderBy(desc(schema.brainVersions.version)).limit(100);
  return (
    <>
      <PageHeader back={{ href: "/app/brain", label: "Company Brain" }} title="Version history" sub="Every change to your Brain, who made it and why. Restore any version." right={<><a href="/app/brain/export?format=md" className="inline-flex h-8 items-center rounded-md border border-border-strong bg-surface px-3 text-[13px] font-medium hover:bg-subtle">Export Markdown</a><a href="/app/brain/export?format=json" className="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-fg-2 hover:bg-subtle">JSON</a></>} />
      {!versions.length ? (
        <EmptyState title="No versions yet" />
      ) : (
        <Card>
          <ol>
            {versions.map((v, i) => (
              <li key={v.id} className="flex gap-4 border-b border-border px-5 py-4 last:border-0">
                <div className="flex flex-col items-center pt-1">
                  <span className={`size-2.5 rounded-full ${i === 0 ? "bg-brand" : "bg-border-strong"}`} />
                  {i < versions.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-[14px] font-semibold">v{v.version}</span>
                    <span className="text-[13px] text-fg-3">{fmtDate(v.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {v.author === "you" ? "You" : "Oryn"} · {v.snapshot.length} facts</span>
                    <span className="flex-1" />
                    {i === 0 ? <Badge tone="brand">Current</Badge> : <RestoreButton id={v.id} version={v.version} />}
                  </div>
                  <p className="mt-1 text-[14px] text-fg-2">{v.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}
