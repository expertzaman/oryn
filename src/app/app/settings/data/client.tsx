"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Dialog } from "@/components/app/dialog";
import { useToast } from "@/components/app/toast";
import { deleteSourceAction, rereadWebsiteAction } from "@/app/onboarding/actions";

export function RemoveSource({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Remove</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Remove this source?" sub={title} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" loading={pending} onClick={() => start(async () => { const r = await deleteSourceAction(id); setOpen(false); if (!r.ok) return toast({ message: r.error ?? "Couldn’t remove", tone: "error" }); toast({ message: "Source removed", tone: "success" }); router.refresh(); })}>Remove</Button></>}>
        <p className="text-[14px] text-fg-2">Facts already in your Brain stay until you change them. Future briefs won’t use this source.</p>
      </Dialog>
    </>
  );
}

export function RereadWebsite({ website }: { website: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => { const r = await rereadWebsiteAction(); if (!r.ok) return toast({ message: r.error ?? "Couldn’t read the site", tone: "error" }); toast({ message: `Re-read ${new URL(website).hostname}`, tone: "success" }); router.refresh(); })}>
      {pending ? "Reading…" : "Re-read website"}
    </Button>
  );
}
