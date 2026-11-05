"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/components/ui";

export function Dialog({ open, onClose, title, sub, children, footer, width = 520, side }: { open: boolean; onClose: () => void; title: string; sub?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; width?: number; side?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] overflow-hidden rounded-xl border-0 bg-surface p-0 text-fg shadow-e4 backdrop:bg-ink-900/45",
        side && "mr-0 h-dvh max-h-dvh rounded-none sm:rounded-l-xl",
      )}
      style={{ maxWidth: width }}
      aria-labelledby="dialog-title"
    >
      {open ? (
        <div className={cn("flex max-h-[inherit] flex-col", side && "h-full")}>
          <div className="flex items-start gap-3 border-b border-border px-6 py-5">
            <div className="min-w-0 flex-1">
              <h2 id="dialog-title" className="text-[18px] font-semibold tracking-[-0.01em]">{title}</h2>
              {sub ? <p className="mt-1 text-[13.5px] text-fg-2">{sub}</p> : null}
            </div>
            <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-md text-fg-3 hover:bg-subtle hover:text-fg">
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

export function RadioCards({ name, options, value, onChange }: { name: string; options: { value: string; label: string; hint?: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="space-y-2">
      {options.map((o) => (
        <label key={o.value} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors", value === o.value ? "border-brand-border bg-brand-soft" : "border-border hover:bg-canvas")}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-0.5 size-4 accent-[#FF6A1F]" />
          <span>
            <span className="block text-[14px] font-medium">{o.label}</span>
            {o.hint ? <span className="block text-[13px] text-fg-3">{o.hint}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}
