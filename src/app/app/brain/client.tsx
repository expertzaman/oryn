"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FieldError, Label, Select, Textarea } from "@/components/ui";
import { Dialog } from "@/components/app/dialog";
import { useToast } from "@/components/app/toast";
import { decideProposal, deleteFact, rebuildBrain, restoreVersion, saveFact } from "../actions";

type Fact = { id: string; category: string; text: string; evidence: "supported" | "weak" | "assumed" };

function FactDialog({ open, onClose, fact, categories }: { open: boolean; onClose: () => void; fact: Fact | null; categories: string[] }) {
  const [f, setF] = useState<Omit<Fact, "id">>({ category: fact?.category ?? categories[0], text: fact?.text ?? "", evidence: fact?.evidence ?? "assumed" });
  const [err, setErr] = useState<string>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Dialog open={open} onClose={onClose} title={fact ? "Edit fact" : "Add a fact"} sub="Saving creates a new Brain version and re-ranks next week’s actions." width={560} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={pending} onClick={() => start(async () => { const r = await saveFact(fact?.id ?? null, f); if (!r.ok) return setErr(r.error); onClose(); toast({ message: fact ? "Fact updated" : "Fact added", tone: "success" }); router.refresh(); })}>Save</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="f-cat">Category</Label><Select id="f-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{[...new Set([...categories, f.category])].map((c) => <option key={c}>{c}</option>)}</Select></div>
          <div><Label htmlFor="f-ev">Evidence</Label><Select id="f-ev" value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value as Fact["evidence"] })}><option value="supported">Supported</option><option value="weak">Weak</option><option value="assumed">Assumed</option></Select></div>
        </div>
        <div><Label htmlFor="f-text">Fact</Label><Textarea id="f-text" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} maxLength={400} placeholder="VP Operations at 3PLs with 50–500 employees signs the contract." /></div>
        <FieldError>{err}</FieldError>
      </div>
    </Dialog>
  );
}

export function AddFactButton({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false);
  const [k, setK] = useState(0);
  return (
    <>
      <Button size="sm" onClick={() => { setK((x) => x + 1); setOpen(true); }}>Add fact</Button>
      <FactDialog key={k} open={open} onClose={() => setOpen(false)} fact={null} categories={categories} />
    </>
  );
}

export function FactActions({ fact, categories }: { fact: Fact; categories: string[] }) {
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Edit</Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirmDel(true)}>Remove</Button>
      <FactDialog key={fact.id + fact.text} open={open} onClose={() => setOpen(false)} fact={fact} categories={categories} />
      <Dialog open={confirmDel} onClose={() => setConfirmDel(false)} title="Remove this fact?" sub={fact.text} footer={<><Button variant="ghost" onClick={() => setConfirmDel(false)}>Cancel</Button><Button variant="danger" loading={pending} onClick={() => start(async () => { const r = await deleteFact(fact.id); setConfirmDel(false); if (!r.ok) return toast({ message: r.error, tone: "error" }); toast({ message: "Fact removed · you can restore it from History", tone: "success" }); router.refresh(); })}>Remove</Button></>}>
        <p className="text-[14px] text-fg-2">It’s kept in version history, so you can restore it later.</p>
      </Dialog>
    </>
  );
}

export function RebuildButton({ disabled, label = "Re-read sources" }: { disabled?: boolean; label?: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button size="sm" variant="secondary" disabled={disabled} loading={pending} onClick={() => start(async () => {
      const r = await rebuildBrain();
      if (!r.ok) return toast({ message: r.error, tone: "error" });
      const n = (r.data as { proposals?: number } | undefined)?.proposals ?? 0;
      toast({ message: n ? `${n} new proposals to review` : "Re-read everything · no new facts found", tone: "ai" });
      router.push(n ? "/app/brain/proposals" : "/app/brain");
      router.refresh();
    })}>
      {pending ? "Reading…" : label}
    </Button>
  );
}

export function ProposalActions({ id, proposedText }: { id: string; proposedText: string }) {
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(proposedText);
  const toast = useToast();
  const router = useRouter();
  const decide = (d: "accepted" | "rejected", t?: string) =>
    start(async () => {
      const r = await decideProposal(id, d, t);
      if (!r.ok) return toast({ message: r.error, tone: "error" });
      setEdit(false);
      toast({ message: d === "accepted" ? "Accepted · new Brain version saved" : "Rejected · Oryn won’t propose it again without new evidence", tone: d === "accepted" ? "ai" : "info" });
      router.refresh();
    });
  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide("rejected")}>Reject</Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => setEdit(true)}>Edit, then accept</Button>
        <Button size="sm" loading={pending} onClick={() => decide("accepted")}>Accept</Button>
      </div>
      <Dialog open={edit} onClose={() => setEdit(false)} title="Edit before accepting" footer={<><Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button><Button loading={pending} disabled={text.trim().length < 5} onClick={() => decide("accepted", text)}>Accept edited fact</Button></>}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={400} aria-label="Fact text" />
      </Dialog>
    </>
  );
}

export function RestoreButton({ id, version }: { id: string; version: number }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Restore</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Restore version ${version}?`} sub="Your current facts are replaced with this version’s facts. The current state stays in history, so you can undo this." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={pending} onClick={() => start(async () => { const r = await restoreVersion(id); setOpen(false); if (!r.ok) return toast({ message: r.error, tone: "error" }); toast({ message: `Restored v${version}`, tone: "success" }); router.push("/app/brain"); router.refresh(); })}>Restore</Button></>} />
    </>
  );
}
