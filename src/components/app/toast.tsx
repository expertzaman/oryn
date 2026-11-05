"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";

type Toast = { id: number; message: string; tone: "success" | "error" | "info" | "ai"; action?: { label: string; onClick: () => void } };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++n.current;
    setList((l) => [...l.slice(-2), { ...t, id }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), t.action ? 7000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4">
        {list.map((t) => (
          <div key={t.id} className={cn("toast-in pointer-events-auto flex max-w-[520px] items-center gap-3 rounded-lg px-4 py-3 text-[14px] shadow-e4", t.tone === "error" ? "bg-danger text-white" : "bg-ink-900 text-white")}>
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", t.tone === "success" && "bg-[#3ad29f]", t.tone === "info" && "bg-sky-500", t.tone === "ai" && "bg-sunrise", t.tone === "error" && "bg-white")} />
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action ? (
              <button
                className="shrink-0 rounded px-2 py-1 text-[13px] font-semibold text-ember-300 hover:bg-white/10"
                onClick={() => {
                  t.action!.onClick();
                  setList((l) => l.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button aria-label="Dismiss" className="shrink-0 rounded px-1 text-white/60 hover:text-white" onClick={() => setList((l) => l.filter((x) => x.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

/** Shows a toast once on mount (used for ?welcome=1 style flags). */
export function MountToast({ message, tone = "ai" }: { message: string; tone?: Toast["tone"] }) {
  const toast = useToast();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    toast({ message, tone });
  }, [message, tone, toast]);
  return null;
}
