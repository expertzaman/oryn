"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Label, Textarea } from "@/components/ui";
import { Dialog, RadioCards } from "./dialog";
import { useToast } from "./toast";
import { createDraftForAction, regenerateWeek, setActionStatus } from "@/app/app/actions";

const DISAGREE = [
  { value: "Evidence is wrong or outdated", label: "The evidence is wrong or outdated" },
  { value: "Right problem, wrong action", label: "Right problem, wrong action" },
  { value: "We already tried this", label: "We already tried this" },
  { value: "Not a priority", label: "Not a priority right now" },
];
const SKIP = [
  { value: "No time this week", label: "No time this week" },
  { value: "Waiting on someone else", label: "Waiting on someone else" },
  { value: "Don't suggest this again", label: "Don’t suggest this again" },
];

export function ActionControls({ id, status, draftKind, draftId, compact, paused }: { id: string; status: string; draftKind: string | null; draftId?: string | null; compact?: boolean; paused?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dlg, setDlg] = useState<null | "done" | "skip" | "disagree">(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [drafting, startDraft] = useTransition();

  const run = (s: "done" | "skipped" | "disagreed" | "open", fb?: { reason?: string; note?: string; outcome?: string }, msg?: string) =>
    start(async () => {
      const r = await setActionStatus(id, s, fb);
      if (!r.ok) return toast({ message: r.error, tone: "error" });
      setDlg(null);
      setReason("");
      setNote("");
      if (msg) toast({ message: msg, tone: "success", action: s !== "open" ? { label: "Undo", onClick: () => run("open", undefined, "Action reopened") } : undefined });
      router.refresh();
    });

  const draft = () =>
    startDraft(async () => {
      if (draftId) return router.push(`/app/drafts/${draftId}`);
      const r = await createDraftForAction(id);
      if (!r.ok) return toast({ message: r.error, tone: "error" });
      if (r.info === "offline") toast({ message: "AI unavailable — created a template draft instead.", tone: "info" });
      router.push(`/app/drafts/${r.data!.id}`);
    });

  if (status !== "open") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" loading={pending} onClick={() => run("open", undefined, "Action reopened")}>
          Reopen
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {draftKind && draftKind !== "none" ? (
          <Button size="sm" variant="primary" loading={drafting} disabled={paused && !draftId} onClick={draft}>
            {draftId ? "Open draft" : `Draft the ${draftKind === "copy" ? "copy" : draftKind}`}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => setDlg("skip")}>
          Skip
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDlg("disagree")}>
          Disagree
        </Button>
        {!compact ? <span className="flex-1" /> : null}
        <Button size="sm" variant="secondary" onClick={() => setDlg("done")} icon={<span aria-hidden>✓</span>}>
          Mark done
        </Button>
      </div>

      <Dialog open={dlg === "done"} onClose={() => setDlg(null)} title="Mark as done" sub="What happened? Oryn uses outcomes to rank next week — even “no reply yet” helps." footer={<><Button variant="ghost" onClick={() => setDlg(null)}>Cancel</Button><Button loading={pending} onClick={() => run("done", { outcome: note }, "Marked done · Oryn will learn from the outcome")}>Mark done</Button></>}>
        <Label htmlFor="outcome" hint="Optional">Outcome</Label>
        <Textarea id="outcome" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Sent to 6 deals — 2 replied, 1 booked a call." autoFocus />
      </Dialog>

      <Dialog open={dlg === "skip"} onClose={() => setDlg(null)} title="Skip this action?" sub="It moves out of this week. Skipped actions can come back if the evidence gets stronger." footer={<><Button variant="ghost" onClick={() => setDlg(null)}>Cancel</Button><Button loading={pending} disabled={!reason} onClick={() => run("skipped", { reason }, "Skipped")}>Skip action</Button></>}>
        <RadioCards name="skip" options={SKIP} value={reason} onChange={setReason} />
      </Dialog>

      <Dialog open={dlg === "disagree"} onClose={() => setDlg(null)} title="Why do you disagree?" sub="Your answer teaches Oryn. It won’t suggest the same thing without new evidence." width={560} footer={<><Button variant="ghost" onClick={() => setDlg(null)}>Cancel</Button><Button loading={pending} disabled={!reason} onClick={() => run("disagreed", { reason, note }, "Thanks — Oryn will re-rank next week")}>Send to Oryn</Button></>}>
        <RadioCards name="disagree" options={DISAGREE} value={reason} onChange={setReason} />
        <div className="mt-4">
          <Label htmlFor="dnote" hint="Optional">Anything Oryn should know?</Label>
          <Textarea id="dnote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="We tested a new headline in August; it didn’t change demo requests." />
        </div>
      </Dialog>
    </>
  );
}

export function RegenerateWeekButton({ variant = "ghost", label = "Regenerate", disabled }: { variant?: "ghost" | "secondary" | "primary" | "ai"; label?: string; disabled?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={variant} disabled={disabled} loading={pending} onClick={() => setOpen(true)}>
        {pending ? "Writing your brief…" : label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Write a new brief?" sub="Oryn replaces this week’s open actions with a fresh set based on your latest evidence and feedback. Completed actions are kept." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={pending} onClick={() => start(async () => { const r = await regenerateWeek(); setOpen(false); if (!r.ok) return toast({ message: r.error, tone: "error" }); toast({ message: r.info === "offline" ? "New brief written with built-in rules (AI unavailable)" : "New brief ready", tone: "ai" }); router.refresh(); })}>Write new brief</Button></>} />
    </>
  );
}
