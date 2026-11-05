"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormAction } from "@/components/app/use-form-action";
import { Alert, Button, Card, EvidenceBadge, FieldError, Input, Label, Progress, Select, SourceChip, Textarea, Thinking, cn, type EvidenceLevel } from "@/components/ui";
import { addEvidenceAction, buildBrainAction, confirmFactAction, deleteFactAction, deleteSourceAction, finishOnboardingAction, goToStep, readSiteAction, saveAnswersAction, updateFactAction, type Res } from "./actions";
import type { AddResult } from "@/server/evidence";

const STEPS = ["Website", "Conversation", "Evidence", "Diagnosis", "Goal"];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Setup progress">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "num grid size-6 place-items-center rounded-full text-[11.5px] font-semibold",
                state === "done" && "bg-brand text-white",
                state === "current" && "bg-ink-900 text-white",
                state === "todo" && "border border-border-strong text-fg-3",
              )}
            >
              {state === "done" ? "✓" : n}
            </span>
            <span className={cn("text-[13px]", state === "todo" ? "text-fg-3" : "font-medium text-fg")}>{s}</span>
            {n < STEPS.length ? <span className={cn("mx-1 h-px w-6", n < current ? "bg-brand" : "bg-border-strong")} aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function StepCard({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 shadow-e2 sm:p-9">
      <p className="overline !text-brand-text">{eyebrow}</p>
      <h1 className="mt-2.5 text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[32px]">{title}</h1>
      {sub ? <p className="mt-2.5 text-[15.5px] leading-relaxed text-fg-2">{sub}</p> : null}
      <div className="mt-8">{children}</div>
    </Card>
  );
}

function BackButton({ to }: { to: number }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" loading={pending} onClick={() => start(() => goToStep(to))}>
      Back
    </Button>
  );
}

/* ---------------- Step 1 ---------------- */
export function StepWebsite({ company, website }: { company: string; website: string | null }) {
  const [state, onSubmit, pending] = useFormAction<Res>(readSiteAction, { ok: false });
  const [noSite, setNoSite] = useState(false);
  return (
    <StepCard eyebrow="Step 1 of 5 · Your company" title="Where can Oryn learn about you?" sub="Oryn reads your public website to draft your ICP, positioning and competitors. You’ll correct anything it gets wrong.">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label htmlFor="company">Company name</Label>
          <Input id="company" name="company" defaultValue={company} required maxLength={80} />
        </div>
        {!noSite ? (
          <div>
            <Label htmlFor="website" hint="Public pages only · about 30 seconds">Company website</Label>
            <Input id="website" name="website" placeholder="acme.com" defaultValue={website ?? ""} inputMode="url" autoComplete="url" required={!noSite} />
          </div>
        ) : null}
        <label className="flex items-center gap-2.5 text-[14px] text-fg-2">
          <input type="checkbox" name="noSite" checked={noSite} onChange={(e) => setNoSite(e.target.checked)} className="size-4 accent-[#FF6A1F]" />
          We don’t have a website yet, or it doesn’t describe us well
        </label>
        <div>
          <Label htmlFor="description" hint={noSite ? "Required" : "Optional"}>
            Describe what you sell and who buys it
          </Label>
          <Textarea id="description" name="description" maxLength={4000} placeholder="We sell route-optimisation software to mid-market logistics companies. Operations leaders buy it to cut empty miles…" required={noSite} />
        </div>
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {pending ? (
          <div className="rounded-lg border border-border bg-canvas p-4">
            <Thinking label={noSite ? "Reading your description…" : "Reading your website — usually under 30 seconds…"} />
            <Progress value={60} tone="ai" className="mt-3" label="Reading" />
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
          <Button type="submit" loading={pending}>
            {noSite ? "Continue" : "Read my website"}
          </Button>
        </div>
      </form>
    </StepCard>
  );
}

/* ---------------- Step 2 ---------------- */
export function StepConversation({ questions, answers, summary }: { questions: string[]; answers: { q: string; a: string }[]; summary: string | null }) {
  const [state, onSubmit, pending] = useFormAction<Res>(saveAnswersAction, { ok: false });
  return (
    <StepCard eyebrow="Step 2 of 5 · Conversation" title="A few questions only you can answer" sub="Short answers are fine. They become facts in your Company Brain, marked as your view until evidence backs them up.">
      {summary ? (
        <div className="mb-6 rounded-lg border border-brand-border bg-brand-soft p-4">
          <p className="overline !text-brand-text">What Oryn read</p>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-fg">{summary}</p>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-6">
        {questions.map((q, i) => (
          <div key={i}>
            <Label htmlFor={`a${i}`}>
              <span className="text-fg-3">{i + 1}.</span> {q}
            </Label>
            <Textarea id={`a${i}`} name={`a${i}`} defaultValue={answers.find((a) => a.q === q)?.a ?? ""} maxLength={1500} className="min-h-[72px]" />
          </div>
        ))}
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          <BackButton to={1} />
          <Button type="submit" loading={pending}>
            Continue
          </Button>
        </div>
      </form>
    </StepCard>
  );
}

/* ---------------- Step 3 ---------------- */
export function EvidenceUploader({ compact }: { compact?: boolean }) {
  const [state, onSubmit, pending] = useFormAction<AddResult | null>(addEvidenceAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setNames([]);
    }
  }, [state]);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (inputRef.current && e.dataTransfer.files.length) {
            inputRef.current.files = e.dataTransfer.files;
            setNames([...e.dataTransfer.files].map((f) => f.name));
          }
        }}
        className={cn("rounded-xl border border-dashed p-6 text-center transition-colors", drag ? "border-brand bg-brand-soft" : "border-border-strong bg-canvas")}
      >
        <p className="text-[15px] font-medium">Drop a CRM export, deck or call notes</p>
        <p className="mt-1 text-[13px] text-fg-3">CSV from HubSpot, Pipedrive or Salesforce · PDF · TXT · MD · up to 5 MB each</p>
        <label className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-md border border-border-strong bg-surface px-4 text-[13.5px] font-medium hover:bg-subtle focus-within:shadow-focus">
          Choose files
          <input ref={inputRef} type="file" name="files" multiple accept=".csv,.pdf,.txt,.md,text/csv,application/pdf,text/plain,text/markdown" className="sr-only" onChange={(e) => setNames([...(e.target.files ?? [])].map((f) => f.name))} />
        </label>
        {names.length ? <p className="mt-3 truncate text-[13px] text-fg-2">{names.join(", ")}</p> : null}
      </div>
      {!compact ? (
        <div>
          <Label htmlFor="notes" hint="Optional">Or paste notes — lost-deal reviews, call notes, customer emails</Label>
          <Textarea id="notes" name="notes" maxLength={60000} placeholder="Lost Northbeam Freight (Oct): VP Ops liked the demo but couldn’t see why it beats their BI dashboard…" />
        </div>
      ) : (
        <Textarea name="notes" maxLength={60000} placeholder="Or paste notes…" aria-label="Paste notes" />
      )}
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? (
        <Alert tone="success" title={`Added ${state.added.length} source${state.added.length > 1 ? "s" : ""}`}>
          {state.added.map((a) => `${a.title} — ${a.detail}`).join(" · ")}
          {state.proposals ? ` · ${state.proposals} Brain proposal${state.proposals > 1 ? "s" : ""} created` : ""}
        </Alert>
      ) : null}
      {state?.ok && state.warnings.length ? <Alert tone="warning">{state.warnings.join(" ")}</Alert> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={pending}>
          {pending ? "Reading…" : "Add evidence"}
        </Button>
      </div>
    </form>
  );
}

export function SourceList({ sources }: { sources: { id: string; title: string; kind: string }[] }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  if (!sources.length) return <p className="text-[14px] text-fg-3">No sources yet.</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {sources.map((s) => (
        <li key={s.id} className="flex items-center gap-3 px-4 py-3">
          <SourceChip label={s.kind === "crm" ? "CRM" : s.kind} kind={s.kind} />
          <span className="min-w-0 flex-1 truncate text-[14px]">{s.title}</span>
          {s.kind !== "website" && s.kind !== "conversation" ? (
            <Button
              size="sm"
              variant="ghost"
              loading={pending && busy === s.id}
              onClick={() => {
                if (!confirm(`Remove “${s.title}”? Deals imported from it are removed too.`)) return;
                setBusy(s.id);
                start(async () => {
                  await deleteSourceAction(s.id);
                });
              }}
            >
              Remove
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function StepEvidence({ sources }: { sources: { id: string; title: string; kind: string }[] }) {
  const [pending, start] = useTransition();
  const hasEvidence = sources.some((s) => ["crm", "document", "notes"].includes(s.kind));
  return (
    <StepCard eyebrow="Step 3 of 5 · Evidence" title="Give Oryn your real evidence" sub="This is what turns guesses into a diagnosis. A CRM export with won and lost deals matters most. Everything is read-only.">
      <EvidenceUploader />
      <div className="mt-8">
        <p className="mb-3 text-[14px] font-semibold">Sources Oryn will read</p>
        <SourceList sources={sources} />
      </div>
      {!hasEvidence ? <p className="mt-4 text-[13px] text-fg-3">You can continue without files — Oryn will mark most facts as Assumed until you add evidence.</p> : null}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-6">
        <BackButton to={2} />
        <Button loading={pending} onClick={() => start(() => goToStep(4))}>
          {hasEvidence ? "Build my Company Brain" : "Continue without files"}
        </Button>
      </div>
    </StepCard>
  );
}

/* ---------------- Step 4 ---------------- */
type F = { id: string; category: string; text: string; evidence: EvidenceLevel; evidenceCount: string | null; refs: { label: string; kind?: string }[]; confirmed: boolean };

function FactRow({ f }: { f: F }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(f.text);
  const [err, setErr] = useState<string | undefined>();
  const [pending, start] = useTransition();
  return (
    <li className={cn("rounded-lg border p-4", f.confirmed ? "border-[#c8eadb] bg-success-soft/40" : "border-border bg-surface")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="overline">{f.category}</p>
        <EvidenceBadge level={f.evidence} count={f.evidenceCount} />
      </div>
      {editing ? (
        <div className="mt-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={400} className="min-h-[64px]" autoFocus aria-label="Corrected fact" />
          <FieldError>{err}</FieldError>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(f.text); setErr(undefined); }}>Cancel</Button>
            <Button size="sm" loading={pending} onClick={() => start(async () => { const r = await updateFactAction(f.id, text); if (!r.ok) setErr(r.error); else setEditing(false); })}>Save correction</Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[15px] font-medium leading-snug">{f.text}</p>
      )}
      {!editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {f.refs.slice(0, 2).map((r, i) => (
            <SourceChip key={i} label={r.label} kind={r.kind} />
          ))}
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => start(() => deleteFactAction(f.id).then(() => undefined))}>Remove</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Correct it</Button>
          <Button size="sm" variant={f.confirmed ? "secondary" : "secondary"} onClick={() => start(() => confirmFactAction(f.id, !f.confirmed).then(() => undefined))}>
            {f.confirmed ? "✓ Looks right" : "Looks right"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function StepBrain({ facts, diagnosis }: { facts: F[]; diagnosis: { bottleneck: string; summary: string; metric?: string | null; evidence: EvidenceLevel; evidenceCount?: string | null } | null }) {
  const router = useRouter();
  const [building, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const started = useRef(false);
  const run = () => {
    setError(null);
    start(async () => {
      try {
        const r = await buildBrainAction();
        if (!r.ok) setError(r.error ?? "Couldn’t build the brain.");
        if (r.info === "offline") setOffline(true);
        router.refresh();
      } catch {
        setError("That took too long or the connection dropped. Try again.");
      }
    });
  };
  useEffect(() => {
    if (!facts.length && !started.current) {
      started.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [next, startNext] = useTransition();

  if (!facts.length || building) {
    return (
      <StepCard eyebrow="Step 4 of 5 · Building" title="Building your Company Brain" sub="Oryn is turning your sources into facts, each linked to its evidence. This usually takes 15–40 seconds.">
        {error ? (
          <div className="space-y-4">
            <Alert tone="danger">{error}</Alert>
            <div className="flex justify-between">
              <BackButton to={3} />
              <Button onClick={run}>Try again</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <Thinking label="Reading sources, grading evidence, looking for the bottleneck…" />
            <Progress value={70} tone="ai" label="Building" />
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-16" />
              ))}
            </div>
          </div>
        )}
      </StepCard>
    );
  }
  const confirmed = facts.filter((f) => f.confirmed).length;
  return (
    <StepCard eyebrow="Step 4 of 5 · Diagnosis" title="Here’s what Oryn believes" sub="Correct anything that’s wrong. Oryn asks before acting on facts marked Assumed.">
      {offline ? <Alert tone="warning" title="Built without the AI model">The AI provider didn’t respond, so this draft comes from Oryn’s built-in rules. You can rebuild it later from the Company Brain.</Alert> : null}
      {diagnosis ? (
        <div className="relative mb-8 overflow-hidden rounded-xl border border-brand-border bg-brand-soft p-5">
          <p className="overline !text-brand-text">Your bottleneck</p>
          <p className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.02em]">{diagnosis.bottleneck}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{diagnosis.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <EvidenceBadge level={diagnosis.evidence} count={diagnosis.evidenceCount} />
            {diagnosis.metric ? <span className="inline-flex h-6 items-center rounded-full bg-surface px-2.5 text-[12px] text-fg-2">Watch: {diagnosis.metric}</span> : null}
          </div>
        </div>
      ) : null}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] font-semibold">{facts.length} facts</p>
        <p className="num text-[13px] text-fg-3">{confirmed} confirmed</p>
      </div>
      <ul className="space-y-3">
        {facts.map((f) => (
          <FactRow key={f.id + f.text + f.confirmed} f={f} />
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <div className="flex gap-2">
          <BackButton to={3} />
          <Button variant="ghost" onClick={run}>Rebuild</Button>
        </div>
        <Button loading={next} onClick={() => startNext(() => goToStep(5))}>
          This looks right
        </Button>
      </div>
    </StepCard>
  );
}

/* ---------------- Step 5 ---------------- */
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function StepGoal({ suggestedMetric, answer }: { suggestedMetric: string | null; answer: string | null }) {
  const [state, onSubmit, pending] = useFormAction<Res>(finishOnboardingAction, { ok: false });
  const [tz, setTz] = useState("UTC");
  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {}
  }, []);
  const minDate = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  return (
    <StepCard eyebrow="Step 5 of 5 · Goal" title="What should this quarter move?" sub="Oryn plans every week around one goal. You can change it any time.">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label htmlFor="title">Goal</Label>
          <Input id="title" name="title" required maxLength={140} placeholder="Reach 12 qualified demos a month" defaultValue={answer && answer.length < 140 ? answer : ""} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="metric">Metric to track</Label>
            <Input id="metric" name="metric" required maxLength={80} defaultValue={suggestedMetric ?? ""} placeholder="Qualified demos per month" />
          </div>
          <div>
            <Label htmlFor="unit" hint="Optional">Unit</Label>
            <Input id="unit" name="unit" maxLength={24} placeholder="demos, $, %" />
          </div>
          <div>
            <Label htmlFor="baseline" hint="Optional">Where it is today</Label>
            <Input id="baseline" name="baseline" type="number" step="any" inputMode="decimal" placeholder="4" />
          </div>
          <div>
            <Label htmlFor="target" hint="Optional">Target</Label>
            <Input id="target" name="target" type="number" step="any" inputMode="decimal" placeholder="12" />
          </div>
          <div>
            <Label htmlFor="dueDate" hint="Optional">By</Label>
            <Input id="dueDate" name="dueDate" type="date" min={minDate} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-canvas p-4">
          <p className="text-[14px] font-semibold">Weekly brief</p>
          <p className="mt-0.5 text-[13px] text-fg-3">When your three actions should be ready.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Select name="briefDay" defaultValue="1" aria-label="Day">
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </Select>
            <Select name="briefHour" defaultValue="8" aria-label="Time">
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
              ))}
            </Select>
            <Input name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} aria-label="Time zone" />
          </div>
        </div>
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {pending ? (
          <div className="rounded-lg border border-border bg-canvas p-4">
            <Thinking label="Proposing bets and writing your first brief — about 20 seconds…" />
            <Progress value={75} tone="ai" className="mt-3" />
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          <BackButton to={4} />
          <Button type="submit" variant="brand" loading={pending}>
            Create my first brief
          </Button>
        </div>
      </form>
    </StepCard>
  );
}
