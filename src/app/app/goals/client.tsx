"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, FieldError, Input, Label, Select, Textarea } from "@/components/ui";
import { Dialog, RadioCards } from "@/components/app/dialog";
import { useToast } from "@/components/app/toast";
import { createBet, proposeBetsAction, saveGoal, setBetStatus } from "../actions";

type Goal = { id: string; title: string; metric: string; baseline: number | null; target: number | null; current: number | null; unit: string | null; dueDate: string | null };
const numOrNull = (s: string) => (s.trim() === "" ? null : Number.isFinite(Number(s)) ? Number(s) : NaN);

export function GoalEditor({ goal }: { goal: Goal | null }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"edit" | "new">(goal ? "edit" : "new");
  const [f, setF] = useState({ title: goal?.title ?? "", metric: goal?.metric ?? "", baseline: goal?.baseline?.toString() ?? "", target: goal?.target?.toString() ?? "", current: goal?.current?.toString() ?? "", unit: goal?.unit ?? "", dueDate: goal?.dueDate ?? "" });
  const [err, setErr] = useState<string>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const openWith = (m: "edit" | "new") => {
    setMode(m);
    if (m === "new") setF({ title: "", metric: "", baseline: "", target: "", current: "", unit: "", dueDate: "" });
    else if (goal) setF({ title: goal.title, metric: goal.metric, baseline: goal.baseline?.toString() ?? "", target: goal.target?.toString() ?? "", current: goal.current?.toString() ?? "", unit: goal.unit ?? "", dueDate: goal.dueDate ?? "" });
    setErr(undefined);
    setOpen(true);
  };
  const submit = () => {
    const vals = { baseline: numOrNull(f.baseline), target: numOrNull(f.target), current: numOrNull(f.current) };
    if (Object.values(vals).some((v) => Number.isNaN(v))) return setErr("Numbers only for baseline, current and target.");
    start(async () => {
      const r = await saveGoal(mode === "edit" && goal ? goal.id : null, { title: f.title, metric: f.metric, ...vals, unit: f.unit.trim() || null, dueDate: f.dueDate || null } as never);
      if (!r.ok) return setErr(r.error);
      setOpen(false);
      toast({ message: mode === "edit" ? "Goal updated" : "New goal set — next brief will plan around it", tone: "success" });
      router.refresh();
    });
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <>
      <div className="flex gap-2">
        {goal ? <Button size="sm" variant="secondary" onClick={() => openWith("edit")}>Update progress</Button> : null}
        <Button size="sm" variant="ghost" onClick={() => openWith("new")}>New goal</Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={mode === "edit" ? "Update goal" : "Set a new goal"} sub={mode === "new" ? "The current goal is archived. Active bets move to the new goal." : "Keep “current” up to date so Oryn knows if you’re on pace."} width={560} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={pending} onClick={submit}>{mode === "edit" ? "Save" : "Set goal"}</Button></>}>
        <div className="space-y-4">
          <div><Label htmlFor="g-title">Goal</Label><Input id="g-title" value={f.title} onChange={set("title")} maxLength={140} placeholder="Reach 12 qualified demos a month" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="g-metric">Metric</Label><Input id="g-metric" value={f.metric} onChange={set("metric")} maxLength={80} /></div>
            <div><Label htmlFor="g-unit" hint="Optional">Unit</Label><Input id="g-unit" value={f.unit} onChange={set("unit")} maxLength={24} /></div>
            <div><Label htmlFor="g-base" hint="Optional">Baseline</Label><Input id="g-base" inputMode="decimal" value={f.baseline} onChange={set("baseline")} /></div>
            <div><Label htmlFor="g-cur" hint="Optional">Current</Label><Input id="g-cur" inputMode="decimal" value={f.current} onChange={set("current")} /></div>
            <div><Label htmlFor="g-target" hint="Optional">Target</Label><Input id="g-target" inputMode="decimal" value={f.target} onChange={set("target")} /></div>
            <div><Label htmlFor="g-due" hint="Optional">Due</Label><Input id="g-due" type="date" value={f.dueDate} onChange={set("dueDate")} /></div>
          </div>
          <FieldError>{err}</FieldError>
        </div>
      </Dialog>
    </>
  );
}

export function ProposeBetsButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button size="sm" variant="ai" disabled={disabled} loading={pending} onClick={() => start(async () => {
      const r = await proposeBetsAction();
      if (!r.ok) return toast({ message: r.error, tone: "error" });
      toast({ message: `${r.data?.count ?? 0} bets proposed${r.info === "offline" ? " (built-in rules)" : ""}`, tone: "ai" });
      router.refresh();
    })}>
      {pending ? "Thinking…" : "Propose bets"}
    </Button>
  );
}

function LimitDialog({ open, onClose, activeBets, onConfirm, pending }: { open: boolean; onClose: () => void; activeBets: { id: string; title: string }[]; onConfirm: (pauseId: string) => void; pending: boolean }) {
  const [pick, setPick] = useState(activeBets[0]?.id ?? "");
  return (
    <Dialog open={open} onClose={onClose} title="You already have 3 active bets" sub="Oryn caps you at 3 so every bet gets a clean signal. Pause one to start this bet — paused bets keep their data." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={pending} disabled={!pick} onClick={() => onConfirm(pick)}>Pause & start</Button></>}>
      <RadioCards name="pause" options={activeBets.map((b) => ({ value: b.id, label: b.title }))} value={pick} onChange={setPick} />
    </Dialog>
  );
}

export function ProposedBetActions({ id, activeCount, activeBets }: { id: string; activeCount: number; activeBets: { id: string; title: string }[] }) {
  const [pending, start] = useTransition();
  const [limit, setLimit] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const startBet = (pauseId?: string) =>
    start(async () => {
      const r = await setBetStatus(id, "active", pauseId);
      if (!r.ok) {
        if (r.error === "LIMIT") return setLimit(true);
        return toast({ message: r.error, tone: "error" });
      }
      setLimit(false);
      toast({ message: "Bet started · it will shape next week’s actions", tone: "success" });
      router.refresh();
    });
  return (
    <div className="flex gap-2">
      <Button size="sm" loading={pending} onClick={() => (activeCount >= 3 ? setLimit(true) : startBet())}>Start bet</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await setBetStatus(id, "dismissed"); router.refresh(); })}>Dismiss</Button>
      <LimitDialog open={limit} onClose={() => setLimit(false)} activeBets={activeBets} onConfirm={(p) => startBet(p)} pending={pending} />
    </div>
  );
}

export function NewBetButton({ activeCount, activeBets }: { activeCount: number; activeBets: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", hypothesis: "", metric: "", durationDays: "21", killCriteria: "" });
  const [err, setErr] = useState<string>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const full = activeCount >= 3;
  const submit = (startNow: boolean) =>
    start(async () => {
      const r = await createBet({ ...f, durationDays: Number(f.durationDays) }, startNow);
      if (!r.ok) return setErr(r.error);
      setOpen(false);
      setF({ title: "", hypothesis: "", metric: "", durationDays: "21", killCriteria: "" });
      toast({ message: startNow ? "Bet started" : "Bet saved as proposed", tone: "success" });
      router.push(`/app/bets/${r.data!.id}`);
    });
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => { setErr(undefined); setOpen(true); }}>Write a bet</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Write your own bet" sub="A bet is a time-boxed test of one idea, with a metric and a point where you stop." width={580} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="secondary" loading={pending} onClick={() => submit(false)}>Save for later</Button><Button loading={pending} disabled={full} onClick={() => submit(true)} title={full ? "3 bets are already active" : undefined}>Start now</Button></>}>
        <div className="space-y-4">
          {full ? <Alert tone="warning">3 bets are active ({activeBets.map((b) => b.title).join(", ")}). Save this one for later, or pause one first.</Alert> : null}
          <div><Label htmlFor="b-title">Name</Label><Input id="b-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} placeholder="ROI calculator for ops leads" /></div>
          <div><Label htmlFor="b-hyp">Hypothesis</Label><Textarea id="b-hyp" value={f.hypothesis} onChange={(e) => setF({ ...f, hypothesis: e.target.value })} maxLength={400} placeholder="If ops leads can size savings before the second call, second-meeting rate rises from 36% to 50%." /></div>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <div><Label htmlFor="b-metric">Metric</Label><Input id="b-metric" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })} maxLength={120} placeholder="Second-meeting rate" /></div>
            <div><Label htmlFor="b-days">Time box</Label><Select id="b-days" value={f.durationDays} onChange={(e) => setF({ ...f, durationDays: e.target.value })}>{[7, 14, 21, 28, 42].map((d) => <option key={d} value={d}>{d} days</option>)}</Select></div>
          </div>
          <div><Label htmlFor="b-kill" hint="Optional">Stop if…</Label><Input id="b-kill" value={f.killCriteria} onChange={(e) => setF({ ...f, killCriteria: e.target.value })} maxLength={200} placeholder="Under 40% by day 14" /></div>
          <FieldError>{err}</FieldError>
        </div>
      </Dialog>
    </>
  );
}
