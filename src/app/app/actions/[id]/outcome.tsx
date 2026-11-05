"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FieldError, Textarea } from "@/components/ui";
import { useToast } from "@/components/app/toast";
import { recordOutcome } from "../../actions";

export function OutcomeForm({ id, initial }: { id: string; initial: string }) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<string>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const dirty = v.trim() !== initial.trim();
  return (
    <div className="mt-3">
      <Textarea value={v} onChange={(e) => setV(e.target.value)} maxLength={1000} placeholder="e.g. Sent to 6 deals — 2 replied, 1 booked a second meeting." aria-label="Outcome" className="min-h-[80px]" />
      <FieldError>{err}</FieldError>
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          variant="secondary"
          disabled={!dirty}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await recordOutcome(id, v);
              if (!r.ok) return setErr(r.error);
              setErr(undefined);
              toast({ message: "Outcome saved", tone: "success" });
              router.refresh();
            })
          }
        >
          Save outcome
        </Button>
      </div>
    </div>
  );
}
