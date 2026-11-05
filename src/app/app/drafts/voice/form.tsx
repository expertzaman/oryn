"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { useToast } from "@/components/app/toast";
import { saveVoice } from "../../actions";

type Voice = { formality: number; directness: number; length: number; energy: number; use: string[]; avoid: string[]; samples: string };

function Slider({ label, low, high, value, onChange }: { label: string; low: string; high: string; value: number; onChange: (v: number) => void }) {
  const id = label.toLowerCase();
  return (
    <div>
      <div className="flex justify-between"><label htmlFor={id} className="text-[14px] font-medium">{label}</label><span className="num text-[13px] text-fg-3">{value}</span></div>
      <input id={id} type="range" min={0} max={100} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[#FF6A1F]" />
      <div className="flex justify-between text-[12px] text-fg-3"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

function Tags({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  const add = () => {
    const t = v.trim().slice(0, 40);
    if (t && !items.some((i) => i.toLowerCase() === t.toLowerCase()) && items.length < 20) onChange([...items, t]);
    setV("");
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-subtle pl-3 pr-1 text-[13px]">
            {i}
            <button type="button" aria-label={`Remove ${i}`} onClick={() => onChange(items.filter((x) => x !== i))} className="grid size-5 place-items-center rounded-full text-fg-3 hover:bg-border hover:text-fg">×</button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} maxLength={40} aria-label={label} />
        <Button variant="secondary" onClick={add} disabled={!v.trim()}>Add</Button>
      </div>
    </div>
  );
}

export function VoiceForm({ initial }: { initial: Voice }) {
  const [v, setV] = useState<Voice>(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const set = <K extends keyof Voice>(k: K) => (x: Voice[K]) => setV((s) => ({ ...s, [k]: x }));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-6 p-6">
        <p className="text-[15px] font-semibold">Tone</p>
        <Slider label="Formality" low="Casual" high="Formal" value={v.formality} onChange={set("formality")} />
        <Slider label="Directness" low="Diplomatic" high="Blunt" value={v.directness} onChange={set("directness")} />
        <Slider label="Length" low="Short" high="Detailed" value={v.length} onChange={set("length")} />
        <Slider label="Energy" low="Calm" high="Enthusiastic" value={v.energy} onChange={set("energy")} />
      </Card>
      <Card className="space-y-6 p-6">
        <p className="text-[15px] font-semibold">Words & examples</p>
        <Tags label="Always use" items={v.use} onChange={set("use")} placeholder="e.g. ops teams" />
        <Tags label="Never use" items={v.avoid} onChange={set("avoid")} placeholder="e.g. synergy" />
        <div>
          <Label htmlFor="samples" hint="Optional · paste 2–3 emails you wrote">Samples of your writing</Label>
          <Textarea id="samples" value={v.samples} onChange={(e) => setV({ ...v, samples: e.target.value })} maxLength={8000} className="min-h-[160px]" />
        </div>
      </Card>
      <div className="flex justify-end gap-2 lg:col-span-2">
        <Button variant="ghost" onClick={() => setV(initial)}>Reset changes</Button>
        <Button loading={pending} onClick={() => start(async () => { const r = await saveVoice(v); if (!r.ok) return toast({ message: r.error, tone: "error" }); toast({ message: "Voice profile saved", tone: "success" }); router.refresh(); })}>Save profile</Button>
      </div>
    </div>
  );
}
