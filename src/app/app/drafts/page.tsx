import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { schema } from "@/server/db";
import { requireActiveWorkspace } from "@/server/service";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { timeAgo } from "@/components/app/blocks";

export const metadata = { title: "Drafts" };

const TABS = [
  { k: "draft", label: "To review" },
  { k: "copied", label: "Copied" },
  { k: "archived", label: "Archived" },
];

export default async function DraftsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "draft" } = await searchParams;
  const status = TABS.some((t) => t.k === tab) ? tab : "draft";
  const { ws, db } = await requireActiveWorkspace();
  const rows = await db.select().from(schema.drafts).where(and(eq(schema.drafts.workspaceId, ws.id), eq(schema.drafts.status, status))).orderBy(desc(schema.drafts.updatedAt)).limit(100);
  return (
    <>
      <PageHeader title="Drafts" sub="Everything Oryn wrote for you. Nothing is sent — you copy, edit and send." right={<ButtonLink href="/app/drafts/voice" variant="secondary" size="sm">Voice profile</ButtonLink>} />
      <div role="tablist" className="mb-4 flex gap-1">
        {TABS.map((t) => (
          <Link key={t.k} role="tab" aria-selected={status === t.k} href={`/app/drafts?tab=${t.k}`} className={`rounded-full px-3.5 py-1.5 text-[13.5px] ${status === t.k ? "bg-ink-900 font-medium text-white" : "text-fg-2 hover:bg-subtle"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {!rows.length ? (
        <EmptyState title={status === "draft" ? "No drafts to review" : "Nothing here yet"} action={status === "draft" ? <ButtonLink href="/app" size="sm">Go to This Week</ButtonLink> : undefined}>
          {status === "draft" ? "Open an action and choose “Draft” — Oryn writes it in your voice." : null}
        </EmptyState>
      ) : (
        <Card className="divide-y divide-border">
          {rows.map((d) => (
            <Link key={d.id} href={`/app/drafts/${d.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-canvas">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium">{d.title}</span>
                <span className="block truncate text-[13px] text-fg-3">{d.subject || d.body.slice(0, 120)}</span>
              </span>
              <Badge>{d.kind === "copy" ? "Website copy" : d.kind === "post" ? "Post" : "Email"}</Badge>
              {d.flags.length ? <Badge tone="warning">{d.flags.length} flag{d.flags.length > 1 ? "s" : ""}</Badge> : null}
              <span className="w-20 text-right text-[12.5px] text-fg-3">{timeAgo(d.updatedAt)}</span>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
