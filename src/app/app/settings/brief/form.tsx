"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, FieldError, Input, Label, Select } from "@/components/ui";
import { useToast } from "@/components/app/toast";
import { RegenerateWeekButton } from "@/components/app/action-controls";
import { saveWorkspaceSettings } from "../../actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function BriefForm({ initial }: { initial: { name: string; briefDay: number; briefHour: number; timezone: string } }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState<string>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Card className="space-y-5 p-6">
        <div>
          <h2 className="text-[16px] font-semibold">Schedule</h2>
          <p className="mt-1 text-[13.5px] text-fg-3">Oryn writes one brief a week. It appears in This Week at this time.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="day">Day</Label><Select id="day" value={f.briefDay} onChange={(e) => setF({ ...f, briefDay: Number(e.target.value) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select></div>
          <div><Label htmlFor="hour">Time</Label><Select id="hour" value={f.briefHour} onChange={(e) => setF({ ...f, briefHour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</Select></div>
          <div><Label htmlFor="tz">Time zone</Label><Input id="tz" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} maxLength={64} /></div>
        </div>
        <div><Label htmlFor="cname">Company name</Label><Input id="cname" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} /></div>
        <FieldError>{err}</FieldError>
        <div className="flex justify-end">
          <Button loading={pending} onClick={() => start(async () => { const r = await saveWorkspaceSettings(f); if (!r.ok) return setErr(r.error); setErr(undefined); toast({ message: "Saved", tone: "success" }); router.refresh(); })}>Save</Button>
        </div>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-[16px] font-semibold">Need a brief now?</h2>
          <p className="mt-1 text-[13.5px] text-fg-3">Write a fresh set of actions from your latest evidence. Completed actions are kept.</p>
        </div>
        <RegenerateWeekButton variant="secondary" label="Write a new brief" />
      </Card>
    </>
  );
}
