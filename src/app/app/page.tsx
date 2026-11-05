import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@/server/db";
import { currentWeek, isPaused, requireActiveWorkspace } from "@/server/service";
import { aiConfigured } from "@/server/ai/provider";
import { Alert, ButtonLink, EmptyState, EvidenceBadge, PageHeader, Progress } from "@/components/ui";
import { ActionCard, BetMini, RailCard, fmtDate } from "@/components/app/blocks";
import { ActionControls, RegenerateWeekButton } from "@/components/app/action-controls";
import { MountToast } from "@/components/app/toast";

export const metadata = { title: "This Week" };

function greeting(tz: string, name: string) {
  let h = new Date().getUTCHours();
  try {
    h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()));
  } catch {}
  const first = name.split(" ")[0];
  return `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${first}`;
}

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const { user, ws, db } = await requireActiveWorkspace();
  const { week, actions } = await currentWeek(db, ws);
  const [bets, [{ n: pending }], learning, goal, draftRows, [{ n: dealCount }]] = await Promise.all([
    db.select().from(schema.bets).where(and(eq(schema.bets.workspaceId, ws.id), inArray(schema.bets.status, ["active", "paused"]))).orderBy(desc(schema.bets.status), schema.bets.createdAt),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.proposals).where(and(eq(schema.proposals.workspaceId, ws.id), eq(schema.proposals.status, "pending"))),
    db.select().from(schema.learnings).where(eq(schema.learnings.workspaceId, ws.id)).orderBy(desc(schema.learnings.createdAt)).limit(1),
    db.select().from(schema.goals).where(and(eq(schema.goals.workspaceId, ws.id), eq(schema.goals.status, "active"))).limit(1),
    actions.length ? db.select({ id: schema.drafts.id, actionId: schema.drafts.actionId }).from(schema.drafts).where(inArray(schema.drafts.actionId, actions.map((a) => a.id))) : Promise.resolve([] as { id: string; actionId: string | null }[]),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.deals).where(eq(schema.deals.workspaceId, ws.id)),
  ]);
  const betTitle = new Map(bets.map((b) => [b.id, b.title]));
  const draftFor = new Map(draftRows.map((d) => [d.actionId, d.id]));
  const paused = isPaused(ws);
  const done = actions.filter((a) => a.status === "done").length;
  const g = goal[0];
  const goalPct = g && g.target != null && g.current != null && g.target !== (g.baseline ?? 0) ? ((g.current - (g.baseline ?? 0)) / (g.target - (g.baseline ?? 0))) * 100 : null;
  const activeBets = bets.filter((b) => b.status === "active").length;

  return (
    <>
      {welcome ? <MountToast message="Your first brief is ready. Start with action 1." /> : null}
      <PageHeader
        title={greeting(ws.timezone, user.name)}
        sub={week ? <>Week of {fmtDate(week.weekStart, { day: "numeric", month: "long" })}{week.headline ? <> · {week.headline}</> : null}</> : "No brief yet"}
        right={
          <>
            <RegenerateWeekButton disabled={paused} />
            <ButtonLink href="/app/ask" variant="ai" size="sm">Ask about this brief</ButtonLink>
          </>
        }
      />
      {!aiConfigured() ? <div className="mb-5"><Alert tone="warning" title="AI model not connected">Briefs are written with Oryn’s built-in rules. Add GROQ_API_KEY or GEMINI_API_KEY in your Vercel project settings for full analysis.</Alert></div> : null}
      {week?.generatedBy === "offline" && aiConfigured() ? <div className="mb-5"><Alert tone="info">This brief was written with built-in rules because the AI provider didn’t respond. Regenerate to try again.</Alert></div> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="actions-h" className="min-w-0 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 id="actions-h" className="text-[17px] font-semibold">This week’s actions</h2>
              <p className="text-[13px] text-fg-3">Ranked by expected impact on your goal · {done} of {actions.length} done</p>
            </div>
          </div>
          {actions.length === 0 ? (
            <EmptyState title="No actions this week yet" action={<RegenerateWeekButton variant="primary" label="Write this week’s brief" disabled={paused} />}>
              {paused ? "Oryn is paused. Resume it to get a new brief." : "Oryn hasn’t written a brief for this week. Generate one now — it takes about 20 seconds."}
            </EmptyState>
          ) : (
            actions.map((a) => (
              <ActionCard
                key={a.id}
                a={{ ...a, betTitle: a.betId ? betTitle.get(a.betId) : null }}
                controls={<ActionControls id={a.id} status={a.status} draftKind={a.draftKind} draftId={draftFor.get(a.id)} paused={paused} />}
              />
            ))
          )}
          {actions.length > 0 && done === actions.length ? (
            <Alert tone="success" title="All done for this week">Nice work. Record outcomes on each action so Oryn learns what moved the needle — or write the next brief early.</Alert>
          ) : null}
        </section>

        <aside className="space-y-4" aria-label="Summary">
          {g ? (
            <RailCard title="Goal" sub={g.dueDate ? `By ${fmtDate(g.dueDate, { day: "numeric", month: "short", year: "numeric" })}` : undefined} right={<Link href="/app/goals" className="text-[12.5px] text-fg-3 hover:text-fg">Edit</Link>}>
              <p className="text-[15px] font-medium leading-snug">{g.title}</p>
              {g.target != null ? (
                <>
                  <div className="num mt-3 flex items-baseline justify-between text-[13px]">
                    <span className="text-fg-3">{g.metric}</span>
                    <span className="font-semibold">{g.current ?? "—"} / {g.target} {g.unit ?? ""}</span>
                  </div>
                  <Progress value={goalPct ?? 0} className="mt-2" label="Goal progress" />
                </>
              ) : <p className="mt-2 text-[13px] text-fg-3">Tracking: {g.metric}</p>}
            </RailCard>
          ) : (
            <RailCard title="No goal set"><ButtonLink href="/app/goals" size="sm" variant="secondary">Set a goal</ButtonLink></RailCard>
          )}

          <RailCard title="Active bets" sub={`${activeBets} of 3 slots used`} right={<Link href="/app/goals" className="text-[12.5px] text-fg-3 hover:text-fg">All</Link>}>
            {bets.length ? <div className="space-y-2">{bets.map((b) => <BetMini key={b.id} b={b} />)}</div> : <p className="text-[13px] text-fg-3">No bets running. <Link href="/app/goals" className="font-medium text-brand-text">Propose some</Link>.</p>}
          </RailCard>

          {Number(pending) > 0 ? (
            <RailCard title={`${pending} Brain proposal${Number(pending) > 1 ? "s" : ""}`} sub="Need your decision">
              <ButtonLink href="/app/brain/proposals" size="sm" variant="brand">Review proposals</ButtonLink>
            </RailCard>
          ) : null}

          {ws.diagnosis ? (
            <RailCard title="Diagnosis" right={<Link href="/app/brain" className="text-[12.5px] text-fg-3 hover:text-fg">Brain</Link>}>
              <p className="text-[15px] font-semibold leading-snug">{ws.diagnosis.bottleneck}</p>
              <p className="mt-1.5 line-clamp-3 text-[13px] text-fg-2">{ws.diagnosis.summary}</p>
              <div className="mt-2.5"><EvidenceBadge level={ws.diagnosis.evidence} count={ws.diagnosis.evidenceCount} /></div>
            </RailCard>
          ) : null}

          {learning[0] ? (
            <RailCard title="Latest learning">
              <p className="text-[14.5px] font-medium leading-snug">{learning[0].title}</p>
              <Link href={`/app/learnings/${learning[0].id}`} className="mt-2 inline-block text-[13px] font-medium text-brand-text hover:underline">Read the memo →</Link>
            </RailCard>
          ) : null}

          <RailCard title="At a glance">
            <dl className="space-y-2 text-[13px]">
              {[
                ["Actions done", `${done} / ${actions.length}`],
                ["Brain version", `v${ws.brainVersion}`],
                ["CRM deals read", Number(dealCount).toLocaleString("en-US")],
                ["Next brief", `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][ws.briefDay]} ${String(ws.briefHour).padStart(2, "0")}:00`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-fg-3">{k}</dt>
                  <dd className="num font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {Number(dealCount) === 0 ? <Link href="/app/settings/data" className="mt-3 inline-block text-[13px] font-medium text-brand-text hover:underline">Add a CRM export →</Link> : null}
          </RailCard>
        </aside>
      </div>
    </>
  );
}
