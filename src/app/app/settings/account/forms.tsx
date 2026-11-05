"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, FieldError, Input, Label } from "@/components/ui";
import { Dialog } from "@/components/app/dialog";
import { useToast } from "@/components/app/toast";
import { changePassword, deleteAccount, updateProfile } from "../../actions";

export function AccountForms({ name, email }: { name: string; email: string }) {
  const [n, setN] = useState(name);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwErr, setPwErr] = useState<string>();
  const [del, setDel] = useState(false);
  const [confirmText, setConfirm] = useState("");
  const [delPw, setDelPw] = useState("");
  const [delErr, setDelErr] = useState<string>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Card className="space-y-4 p-6">
        <h2 className="text-[16px] font-semibold">Profile</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="n">Name</Label><Input id="n" value={n} onChange={(e) => setN(e.target.value)} maxLength={80} /></div>
          <div><Label htmlFor="e">Email</Label><Input id="e" value={email} disabled /></div>
        </div>
        <div className="flex justify-end"><Button variant="secondary" disabled={n.trim() === name || !n.trim()} loading={pending} onClick={() => start(async () => { const r = await updateProfile(n); if (!r.ok) return toast({ message: r.error, tone: "error" }); toast({ message: "Profile updated", tone: "success" }); router.refresh(); })}>Save</Button></div>
      </Card>
      <Card className="space-y-4 p-6">
        <h2 className="text-[16px] font-semibold">Password</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="cp">Current password</Label><Input id="cp" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div><Label htmlFor="np" hint="8+ chars, letter + number">New password</Label><Input id="np" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} maxLength={128} /></div>
        </div>
        <FieldError>{pwErr}</FieldError>
        <div className="flex justify-end"><Button variant="secondary" disabled={!pw.current || !pw.next} loading={pending} onClick={() => start(async () => { const r = await changePassword(pw.current, pw.next); if (!r.ok) return setPwErr(r.error); setPwErr(undefined); setPw({ current: "", next: "" }); toast({ message: "Password changed", tone: "success" }); })}>Change password</Button></div>
      </Card>
      <Card className="space-y-3 p-6">
        <h2 className="text-[16px] font-semibold">Your data</h2>
        <p className="text-[13.5px] text-fg-3">Download your Company Brain, goals, bets and learnings.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/app/brain/export?format=md" className="inline-flex h-9 items-center rounded-md border border-border-strong bg-surface px-4 text-[13.5px] font-medium hover:bg-subtle">Export Markdown</a>
          <a href="/app/brain/export?format=json" className="inline-flex h-9 items-center rounded-md border border-border-strong bg-surface px-4 text-[13.5px] font-medium hover:bg-subtle">Export JSON</a>
        </div>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-4 border-[#f6cccc] p-6">
        <div>
          <h2 className="text-[16px] font-semibold text-danger">Delete account</h2>
          <p className="mt-1 text-[13.5px] text-fg-3">Permanently deletes your workspace, Brain, sources, drafts and history.</p>
        </div>
        <Button variant="danger" onClick={() => { setDelErr(undefined); setDel(true); }}>Delete…</Button>
      </Card>
      <Dialog open={del} onClose={() => setDel(false)} title="Delete your account?" sub="This can’t be undone. Export your data first if you want a copy." footer={<><Button variant="ghost" onClick={() => setDel(false)}>Cancel</Button><Button variant="danger" disabled={confirmText !== "DELETE" || !delPw} loading={pending} onClick={() => start(async () => { const r = await deleteAccount(confirmText, delPw); if (r && !r.ok) setDelErr(r.error); })}>Delete forever</Button></>}>
        <div className="space-y-4">
          <div><Label htmlFor="dc">Type DELETE to confirm</Label><Input id="dc" value={confirmText} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></div>
          <div><Label htmlFor="dp">Password</Label><Input id="dp" type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" /></div>
          <FieldError>{delErr}</FieldError>
        </div>
      </Dialog>
    </>
  );
}
