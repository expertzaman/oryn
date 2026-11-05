"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { RadioCards } from "@/components/app/dialog";
import { useToast } from "@/components/app/toast";
import { setPause } from "../../actions";

const fmt = (s: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(s));

export function PauseForm({ paused, until, since }: { paused: boolean; until: string | null; since: string | null }) {
  const [mode, setMode] = useState("week");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const go = (m: "week" | "indefinite" | "resume") =>
    start(async () => {
      const r = await setPause(m);
      if (!r.ok) return toast({ message: r.error, tone: "error" });
      toast({ message: m === "resume" ? "Oryn resumed" : "Oryn paused", tone: m === "resume" ? "success" : "info" });
      router.refresh();
    });
  if (paused)
    return (
      <Card className="border-[#f4dfb8] p-6">
        <h2 className="text-[18px] font-semibold">Oryn is paused</h2>
        <p className="mt-1.5 text-[14px] text-fg-2">Since {since ? fmt(since) : "—"}{until ? ` · resumes automatically ${fmt(until)}` : " · until you resume"}. Nothing new is generated; your data stays put.</p>
        <Button className="mt-5" loading={pending} onClick={() => go("resume")}>Resume now</Button>
      </Card>
    );
  return (
    <Card className="p-6">
      <h2 className="text-[18px] font-semibold">Pause Oryn</h2>
      <p className="mt-1.5 text-[14px] text-fg-2">Stops new briefs, drafts, proposals and Ask Oryn answers instantly. Your data, bets and history are kept, and you can still read everything.</p>
      <div className="mt-5">
        <RadioCards name="pause" value={mode} onChange={setMode} options={[{ value: "week", label: "Pause for 1 week", hint: "Resumes automatically" }, { value: "indefinite", label: "Pause until I resume" }]} />
      </div>
      <Button variant="danger" className="mt-5" loading={pending} onClick={() => go(mode as "week" | "indefinite")}>Pause Oryn</Button>
    </Card>
  );
}
