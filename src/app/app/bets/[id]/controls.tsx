"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FieldError, Label, Select, Textarea } from "@/components/ui";
import { Dialog, RadioCards } from "@/components/app/dialog";
import { useToast } from "@/components/app/toast";
import { endBet, extendBet, setBetStatus } from "../../actions";

export function BetControls({ id, status, activeBets }: { id: string; status: string; activeBets: { id: string; title: string }[] }) {
  const [pending, start] = useTransition();
  const [dlg, setDlg] = useState<null | "end" | "extend" | "limit">(null);
  const [outcome, setOutcome] = useState<"won" | "killed">("won");
  const [note, setNote] = useState("");
  const [days, setDays] = useState("7");
  const [pauseId, setPauseId] = useState(activeBets[0]?.id ?? "");
  const [err, setErr] = useState<string>();
  const toast = useToast();
  const router = useRouter();
  const go = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        if (r.error === "LIMIT") return setDlg("limit");
        setErr(r.error);
        return toast({ message: r.error ?? "Something went wrong", tone: "error" });
      }
      setErr(undefined);
      setDlg(null);
      toast({ message: msg, tone: "success" });
      after?.();
      router.refresh();
    });

  if (status === "won" || status === "killed") return <p className="text-[13.5px] text-fg-3">This bet has ended. Its learning lives in Learnings.</p>;

  return (
    <div className="space-y-2">
      {status === "active" ? (
        <>
          <Button className="w-full" onClick={() => { setErr(undefined); setDlg("end"); }}>End bet & record result</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDlg("extend")}>Extend</Button>
            <Button variant="secondary" size="sm" loading={pending} onClick={() => go(() => setBetStatus(id, "paused"), "Bet paused · slot freed")}>Pause</Button>
          </div>
        </>
      ) : (
        <>
          <Button className="w-full" loading={pending} onClick={() => go(() => setBetStatus(id, "active"), status === "paused" ? "Bet resumed" : "Bet started")}>{status === "paused" ? "Resume bet" : "Start bet"}</Button>
          {status === "paused" ? <Button variant="secondary" className="w-full" onClick={() => { setErr(undefined); setDlg("end"); }}>End bet & record result</Button> : null}
          {status !== "dismissed" && status !== "paused" ? <Button variant="ghost" size="sm" className="w-full" onClick={() => go(() => setBetStatus(id, "dismissed"), "Bet dismissed", () => router.push("/app/goals"))}>Dismiss</Button> : null}
        </>
      )}

      <Dialog open={dlg === "end"} onClose={() => setDlg(null)} title="End this bet" sub="Oryn turns your result into a learning memo and adjusts future recommendations." width={560} footer={<><Button variant="ghost" onClick={() => setDlg(null)}>Cancel</Button><Button loading={pending} variant={outcome === "won" ? "primary" : "danger"} onClick={() => go(async () => { const r = await endBet(id, outcome, note); if (r.ok && r.data) router.push(`/app/learnings/${r.data.learningId}`); return r; }, "Bet closed · learning memo written")}>{pending ? "Writing memo…" : outcome === "won" ? "Close as won" : "Kill bet"}</Button></>}>
        <RadioCards name="outcome" value={outcome} onChange={(v) => setOutcome(v as "won" | "killed")} options={[{ value: "won", label: "It worked", hint: "The metric moved the way the hypothesis predicted." }, { value: "killed", label: "It didn’t work", hint: "Kill it and record why, so Oryn doesn’t propose it again." }]} />
        <div className="mt-4">
          <Label htmlFor="result">What happened?</Label>
          <Textarea id="result" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} placeholder="Second-meeting rate went from 36% to 44% across 18 first calls. Two prospects used the calculator before the call." />
          <FieldError>{err}</FieldError>
        </div>
      </Dialog>

      <Dialog open={dlg === "extend"} onClose={() => setDlg(null)} title="Extend the time box" footer={<><Button variant="ghost" onClick={() => setDlg(null)}>Cancel</Button><Button loading={pending} onClick={() => go(() => extendBet(id, Number(days)), `Extended by ${days} days`)}>Extend</Button></>}>
        <Label htmlFor="days">Add</Label>
        <Select id="days" value={days} onChange={(e) => setDays(e.target.value)}>{[3, 7, 14, 21].map((d) => <option key={d} value={d}>{d} days</option>)}</Select>
      </Dialog>

      <Dialog open={dlg === "limit"} onClose={() => setDlg(null)} title="You already have 3 active bets" sub="Pause one to make room. Paused bets keep their data and remaining time." footer={<><Button variant="ghost" onClick={() => setDlg(null)}>Cancel</Button><Button loading={pending} disabled={!pauseId} onClick={() => go(() => setBetStatus(id, "active", pauseId), "Swapped bets")}>Pause & start</Button></>}>
        <RadioCards name="pause" value={pauseId} onChange={setPauseId} options={activeBets.map((b) => ({ value: b.id, label: b.title }))} />
      </Dialog>
    </div>
  );
}
