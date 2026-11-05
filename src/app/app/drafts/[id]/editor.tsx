"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, Input, Label, Textarea } from "@/components/ui";
import { Dialog } from "@/components/app/dialog";
import { useToast } from "@/components/app/toast";
import { deleteDraft, regenerateDraft, resolveFlag, saveDraft, setDraftStatus } from "../../actions";

type Draft = { id: string; kind: string; title: string; recipient: string; subject: string; body: string; flags: { text: string; issue: string; suggestion?: string }[]; status: string };

export function DraftEditor({ draft, paused }: { draft: Draft; paused: boolean }) {
  const [f, setF] = useState({ recipient: draft.recipient, subject: draft.subject, body: draft.body });
  const [saving, startSave] = useTransition();
  const [busy, start] = useTransition();
  const [regen, setRegen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [del, setDel] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const dirty = f.body !== draft.body || f.subject !== draft.subject || f.recipient !== draft.recipient;
  const isEmail = draft.kind === "email";
  const words = f.body.trim() ? f.body.trim().split(/\s+/).length : 0;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = (after?: () => void) =>
    startSave(async () => {
      const r = await saveDraft(draft.id, f);
      if (!r.ok) return toast({ message: r.error, tone: "error" });
      if (after) after();
      else toast({ message: "Saved", tone: "success" });
      router.refresh();
    });

  const copy = async () => {
    const text = isEmail ? `${f.subject ? `Subject: ${f.subject}\n\n` : ""}${f.body}` : f.body;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast({ message: "Your browser blocked the clipboard. Select the text and copy it manually.", tone: "error" });
      return;
    }
    const doMark = async () => {
      const r = await setDraftStatus(draft.id, "copied");
      if (r.ok) {
        toast({ message: draft.flags.length ? "Copied — check the flagged claim before sending" : "Copied to clipboard", tone: "success" });
        router.refresh();
      }
    };
    if (dirty) save(doMark);
    else start(doMark);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge>{isEmail ? "Email" : draft.kind === "post" ? "Post" : "Website copy"}</Badge>
          {draft.status === "copied" ? <Badge tone="success">Copied</Badge> : null}
          {draft.status === "archived" ? <Badge>Archived</Badge> : null}
          <span className="flex-1" />
          <span className="num text-[12.5px] text-fg-3">{words} words{dirty ? " · unsaved changes" : ""}</span>
        </div>
        {isEmail ? (
          <div className="mb-4 grid gap-3">
            <div><Label htmlFor="to">To</Label><Input id="to" value={f.recipient} onChange={(e) => setF({ ...f, recipient: e.target.value })} maxLength={200} /></div>
            <div><Label htmlFor="subject">Subject</Label><Input id="subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={200} /></div>
          </div>
        ) : null}
        <Label htmlFor="body">{isEmail ? "Message" : "Text"}</Label>
        <Textarea id="body" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={10000} className="min-h-[360px] text-[15px] leading-[1.65]" />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={copy} loading={busy} icon={<span aria-hidden>⧉</span>}>Copy</Button>
          <Button variant="secondary" disabled={!dirty} loading={saving} onClick={() => save()}>Save</Button>
          <Button variant="ghost" disabled={paused} onClick={() => setRegen(true)}>Rewrite…</Button>
          <span className="flex-1" />
          {draft.status !== "archived" ? (
            <Button variant="ghost" size="sm" onClick={() => start(async () => { await setDraftStatus(draft.id, "archived"); toast({ message: "Archived", tone: "info" }); router.push("/app/drafts"); })}>Archive</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => start(async () => { await setDraftStatus(draft.id, "draft"); router.refresh(); })}>Unarchive</Button>
          )}
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDel(true)}>Delete</Button>
        </div>
      </Card>

      <aside className="space-y-4">
        <Card className={`p-4 ${draft.flags.length ? "border-[#f4dfb8]" : ""}`}>
          <p className="text-[14px] font-semibold">{draft.flags.length ? `${draft.flags.length} claim${draft.flags.length > 1 ? "s" : ""} to check` : "No flagged claims"}</p>
          <p className="mt-0.5 text-[12.5px] text-fg-3">Oryn flags statements your evidence doesn’t support.</p>
          <ul className="mt-3 space-y-3">
            {draft.flags.map((fl, i) => (
              <li key={i} className="rounded-lg bg-warning-soft p-3">
                <p className="text-[13.5px] font-medium">“{fl.text}”</p>
                <p className="mt-1 text-[13px] text-fg-2">{fl.issue}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {fl.suggestion ? <Button size="sm" variant="secondary" disabled={dirty} title={dirty ? "Save your edits first" : undefined} onClick={() => start(async () => { await resolveFlag(draft.id, fl.text, fl.suggestion!); router.refresh(); })}>Use: “{fl.suggestion.slice(0, 40)}{fl.suggestion.length > 40 ? "…" : ""}”</Button> : null}
                  <Button size="sm" variant="ghost" disabled={dirty} onClick={() => start(async () => { await resolveFlag(draft.id, fl.text, null); router.refresh(); })}>Ignore</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <p className="text-[14px] font-semibold">Written in your voice</p>
          <p className="mt-1 text-[13px] text-fg-2">Tune tone, length and words to avoid in your voice profile.</p>
          <Link href="/app/drafts/voice" className="mt-2 inline-block text-[13px] font-medium text-brand-text hover:underline">Edit voice profile →</Link>
        </Card>
      </aside>

      <Dialog open={regen} onClose={() => setRegen(false)} title="Rewrite this draft" sub="Your current text will be replaced." footer={<><Button variant="ghost" onClick={() => setRegen(false)}>Cancel</Button><Button loading={busy} onClick={() => start(async () => { const r = await regenerateDraft(draft.id, instruction); setRegen(false); if (!r.ok) return toast({ message: r.error, tone: "error" }); toast({ message: r.info === "offline" ? "AI unavailable — template restored" : "Rewritten", tone: "ai" }); setInstruction(""); router.refresh(); })}>{busy ? "Writing…" : "Rewrite"}</Button></>}>
        <Label htmlFor="instr" hint="Optional">How should it change?</Label>
        <Textarea id="instr" value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={400} placeholder="Shorter, and mention the 14-day go-live." />
      </Dialog>
      <Dialog open={del} onClose={() => setDel(false)} title="Delete this draft?" sub="This can’t be undone." footer={<><Button variant="ghost" onClick={() => setDel(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => start(() => deleteDraft(draft.id).then(() => undefined))}>Delete</Button></>} />
    </div>
  );
}
