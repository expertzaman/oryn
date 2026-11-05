"use client";

import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui";
import { reactToLearning } from "../../actions";

export function Reaction({ id, current }: { id: string; current: string | null }) {
  const [opt, setOpt] = useOptimistic(current);
  const [, start] = useTransition();
  const set = (r: "agree" | "disagree") =>
    start(async () => {
      const next = opt === r ? null : r;
      setOpt(next);
      await reactToLearning(id, next);
    });
  return (
    <div className="flex gap-2" role="group" aria-label="Your reaction">
      <Button size="sm" variant={opt === "agree" ? "primary" : "secondary"} aria-pressed={opt === "agree"} onClick={() => set("agree")}>
        {opt === "agree" ? "✓ Agreed" : "Agree"}
      </Button>
      <Button size="sm" variant={opt === "disagree" ? "primary" : "secondary"} aria-pressed={opt === "disagree"} onClick={() => set("disagree")}>
        {opt === "disagree" ? "✓ Disagreed" : "Disagree"}
      </Button>
    </div>
  );
}
