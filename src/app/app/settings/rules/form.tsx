"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AutonomyChip, Button, Card, Input, cn } from "@/components/ui";
import { useToast } from "@/components/app/toast";
import { saveRules } from "../../actions";

type Rules = { neverPricing: boolean; flagUnsourced: boolean; askBeforeAssumed: boolean; custom: string[] };

export function Toggle({ checked, onChange, label, hint, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; id: string }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div>
        <label htmlFor={id} className="text-[14.5px] font-medium">{label}</label>
        {hint ? <p className="mt-0.5 text-[13px] text-fg-3">{hint}</p> : null}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-ink-300")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-e1 transition-[left]", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

export function RulesForm({ rules, autonomy, areas }: { rules: Rules; autonomy: Record<string, number>; areas: string[] }) {
  const [r, setR] = useState(rules);
  const [a, setA] = useState(autonomy);
  const [custom, setCustom] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const addCustom = () => {
    const t = custom.trim();
    if (t.length < 3 || r.custom.length >= 15) return;
    setR({ ...r, custom: [...r.custom, t.slice(0, 200)] });
    setCustom("");
  };
  return (
    <>
      <Card className="px-6 py-2">
        <h2 className="pt-4 text-[16px] font-semibold">Guardrails</h2>
        <div className="divide-y divide-border">
          <Toggle id="r1" label="Never mention pricing in drafts" hint="Pricing questions are left for you." checked={r.neverPricing} onChange={(v) => setR({ ...r, neverPricing: v })} />
          <Toggle id="r2" label="Flag any claim without a source" hint="Unsupported numbers are highlighted in drafts." checked={r.flagUnsourced} onChange={(v) => setR({ ...r, flagUnsourced: v })} />
          <Toggle id="r3" label="Ask before using Assumed facts" hint="Oryn notes when an action relies on unverified facts." checked={r.askBeforeAssumed} onChange={(v) => setR({ ...r, askBeforeAssumed: v })} />
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-[16px] font-semibold">Custom rules</h2>
        <p className="mt-1 text-[13.5px] text-fg-3">Plain-language instructions Oryn follows in every brief and draft.</p>
        <ul className="mt-4 space-y-2">
          {r.custom.map((c, i) => (
            <li key={i} className="flex items-center gap-3 rounded-md bg-canvas px-3 py-2.5 text-[14px]">
              <span className="flex-1">“{c}”</span>
              <button aria-label="Remove rule" onClick={() => setR({ ...r, custom: r.custom.filter((_, j) => j !== i) })} className="text-fg-3 hover:text-danger">×</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} maxLength={200} placeholder="Always mention our 14-day go-live in follow-ups" aria-label="New rule" />
          <Button variant="secondary" onClick={addCustom} disabled={custom.trim().length < 3}>Add</Button>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-[16px] font-semibold">Autonomy by area</h2>
        <p className="mt-1 text-[13.5px] text-fg-3">Founder plan supports up to L2. Approve & run (L3+) comes with the Platform plan.</p>
        <div className="mt-4 divide-y divide-border">
          {areas.map((area) => (
            <div key={area} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <span className="text-[14.5px] font-medium">{area}</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={area}>
                {[0, 1, 2].map((l) => (
                  <button key={l} role="radio" aria-checked={a[area] === l} onClick={() => setA({ ...a, [area]: l })} className="rounded-full">
                    <AutonomyChip level={l} state={a[area] === l ? "current" : "available"} />
                  </button>
                ))}
                <AutonomyChip level={3} state="locked" />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="flex justify-end">
        <Button loading={pending} onClick={() => start(async () => { const res = await saveRules(r, a); if (!res.ok) return toast({ message: res.error, tone: "error" }); toast({ message: "Rules saved", tone: "success" }); router.refresh(); })}>Save changes</Button>
      </div>
    </>
  );
}
