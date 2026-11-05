import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { getWorkspace } from "@/server/service";
import { aiConfigured } from "@/server/ai/provider";
import { DEFAULT_QUESTIONS } from "@/server/ai/tasks";
import { Logo } from "@/components/ui";
import { Stepper, StepWebsite, StepConversation, StepEvidence, StepBrain, StepGoal } from "./steps";
import { signOut } from "../(auth)/actions";

export const metadata = { title: "Set up your workspace" };
export const maxDuration = 60;

export default async function OnboardingPage() {
  const user = await requireUser();
  const db = await getDb();
  let ws = await getWorkspace(db, user.id);
  if (!ws) {
    [ws] = await db.insert(schema.workspaces).values({ ownerId: user.id, name: `${user.name.split(" ")[0]}’s company` }).returning();
  }
  if (ws.stage === "active") redirect("/app");
  const step = ws.onboardingStep;
  const [srcs, facts] = await Promise.all([
    db.select({ id: schema.sources.id, title: schema.sources.title, kind: schema.sources.kind, createdAt: schema.sources.createdAt, meta: schema.sources.meta }).from(schema.sources).where(eq(schema.sources.workspaceId, ws.id)).orderBy(desc(schema.sources.createdAt)),
    db.select().from(schema.facts).where(eq(schema.facts.workspaceId, ws.id)).orderBy(schema.facts.category),
  ]);
  const ai = aiConfigured();

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-5 sm:px-8">
          <Logo href={null} />
          <div className="mx-auto hidden md:block">
            <Stepper current={step} />
          </div>
          <form action={signOut} className="ml-auto md:ml-0">
            <button className="rounded-md px-3 py-2 text-[13px] text-fg-3 hover:bg-subtle hover:text-fg">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-6 md:hidden">
          <p className="overline">Step {step} of 5</p>
        </div>
        {!ai ? (
          <div className="mb-6 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-[13.5px] text-fg-2">
            <strong className="text-warning">AI keys not configured.</strong> Oryn will use its built-in rules until a GROQ_API_KEY or GEMINI_API_KEY is added to the deployment.
          </div>
        ) : null}
        {step === 1 && <StepWebsite company={ws.name} website={ws.website} />}
        {step === 2 && <StepConversation questions={ws.questions?.length ? ws.questions : DEFAULT_QUESTIONS} answers={ws.answers ?? []} summary={ws.siteRead?.summary ?? null} />}
        {step === 3 && <StepEvidence sources={srcs.map((s) => ({ id: s.id, title: s.title, kind: s.kind }))} />}
        {step === 4 && (
          <StepBrain
            facts={facts.map((f) => ({ id: f.id, category: f.category, text: f.text, evidence: f.evidence, evidenceCount: f.evidenceCount, refs: f.refs, confirmed: f.confirmed }))}
            diagnosis={ws.diagnosis ?? null}
          />
        )}
        {step >= 5 && <StepGoal suggestedMetric={ws.diagnosis?.metric ?? null} answer={ws.answers?.[1]?.a ?? null} />}
      </main>
    </div>
  );
}
