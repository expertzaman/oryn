import Link from "next/link";
import { and, desc, eq, lt } from "drizzle-orm";
import { schema } from "@/server/db";
import { requireActiveWorkspace } from "@/server/service";
import { AgentMark, Card, EmptyState, PageHeader } from "@/components/ui";
import { fmtDate } from "@/components/app/blocks";

export const metadata = { title: "Activity" };
const PAGE = 50;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ who?: string; before?: string }> }) {
  const { who, before } = await searchParams;
  const { ws, db } = await requireActiveWorkspace();
  const conds = [eq(schema.activities.workspaceId, ws.id)];
  if (who === "you" || who === "oryn") conds.push(eq(schema.activities.actor, who));
  const beforeDate = before ? new Date(before) : null;
  if (beforeDate && !Number.isNaN(beforeDate.getTime())) conds.push(lt(schema.activities.createdAt, beforeDate));
  const rows = await db.select().from(schema.activities).where(and(...conds)).orderBy(desc(schema.activities.createdAt)).limit(PAGE + 1);
  const more = rows.length > PAGE;
  const list = rows.slice(0, PAGE);
  const byDay = new Map<string, typeof list>();
  for (const r of list) {
    const k = fmtDate(r.createdAt, { weekday: "long", day: "numeric", month: "long" });
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  const tab = (k: string | undefined, label: string) => (
    <Link href={k ? `/app/activity?who=${k}` : "/app/activity"} aria-current={who === k ? "page" : undefined} className={`rounded-full px-3.5 py-1.5 text-[13.5px] ${who === k ? "bg-ink-900 font-medium text-white" : "text-fg-2 hover:bg-subtle"}`}>{label}</Link>
  );
  return (
    <>
      <PageHeader title="Activity" sub="Everything Oryn read, wrote and changed — and everything you decided." />
      <div className="mb-4 flex gap-1">{tab(undefined, "All")}{tab("oryn", "Oryn")}{tab("you", "You")}</div>
      {!list.length ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Card className="overflow-hidden">
          {[...byDay.entries()].map(([day, items]) => (
            <div key={day}>
              <p className="overline border-b border-border bg-canvas px-5 py-2.5">{day}</p>
              <ul className="divide-y divide-border">
                {items.map((a) => {
                  const inner = (
                    <>
                      <span className="num w-14 shrink-0 pt-0.5 text-[12.5px] text-fg-3">{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ws.timezone }).format(a.createdAt)}</span>
                      <span className="mt-0.5 shrink-0">{a.actor === "oryn" ? <AgentMark size={18} /> : <span className="grid size-[18px] place-items-center rounded-full bg-ink-900 text-[9px] font-bold text-white">YOU</span>}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium">{a.message}</span>
                        {a.detail ? <span className="block truncate text-[13px] text-fg-3">{a.detail}</span> : null}
                      </span>
                    </>
                  );
                  return <li key={a.id}>{a.href ? <Link href={a.href} className="flex gap-3 px-5 py-3 hover:bg-canvas">{inner}</Link> : <div className="flex gap-3 px-5 py-3">{inner}</div>}</li>;
                })}
              </ul>
            </div>
          ))}
        </Card>
      )}
      {more ? (
        <div className="mt-4 text-center">
          <Link href={`/app/activity?${who ? `who=${who}&` : ""}before=${encodeURIComponent(list[list.length - 1].createdAt.toISOString())}`} className="inline-flex h-9 items-center rounded-md border border-border-strong bg-surface px-4 text-[13.5px] font-medium hover:bg-subtle">Older activity</Link>
        </div>
      ) : null}
    </>
  );
}
