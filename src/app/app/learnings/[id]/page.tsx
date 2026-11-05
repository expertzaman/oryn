import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/server/db";
import { requireActiveWorkspace } from "@/server/service";
import { ButtonLink, Card, EvidenceBadge, PageHeader } from "@/components/ui";
import { fmtDate } from "@/components/app/blocks";
import { Reaction } from "./reaction";

export const metadata = { title: "Learning memo" };

export default async function LearningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { ws, db } = await requireActiveWorkspace();
  const [l] = await db.select().from(schema.learnings).where(and(eq(schema.learnings.id, id), eq(schema.learnings.workspaceId, ws.id)));
  if (!l) notFound();
  const [bet] = l.betId ? await db.select({ id: schema.bets.id, title: schema.bets.title, status: schema.bets.status }).from(schema.bets).where(eq(schema.bets.id, l.betId)) : [];
  const sections = [
    ["What we tried", l.tried],
    ["What happened", l.happened],
    ["What we now believe", l.believe],
    ["What changes", l.changes],
  ];
  return (
    <>
      <PageHeader back={{ href: "/app/learnings", label: "Learnings" }} title="Learning memo" sub={`${fmtDate(l.createdAt, { day: "numeric", month: "long", year: "numeric" })}${bet ? ` · bet: ${bet.title}` : ""}`} />
      <Card className="mx-auto max-w-[780px] p-6 sm:p-10">
        <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.025em]">{l.title}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <EvidenceBadge level={l.evidence} count={l.evidenceCount} />
        </div>
        <div className="mt-8 divide-y divide-border border-t border-border">
          {sections.map(([h, t], i) => (
            <section key={h} className="grid gap-2 py-6 sm:grid-cols-[48px_1fr]">
              <span className="num text-[13px] font-semibold text-brand-text">0{i + 1}</span>
              <div>
                <h3 className="text-[16px] font-semibold">{h}</h3>
                <p className="mt-1.5 text-[15.5px] leading-relaxed text-fg-2">{t}</p>
              </div>
            </section>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-6">
          <Reaction id={l.id} current={l.reaction} />
          <span className="flex-1" />
          <ButtonLink href={`/app/ask?q=${encodeURIComponent(`What should I do differently based on “${l.title}”?`)}`} variant="ai" size="sm">Ask Oryn</ButtonLink>
          {bet ? <Link href={`/app/bets/${bet.id}`} className="text-[13.5px] font-medium text-fg-2 hover:text-fg">View bet →</Link> : null}
        </div>
      </Card>
    </>
  );
}
