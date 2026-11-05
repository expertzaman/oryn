"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AgentMark, Button, Kbd, SourceChip, Thinking } from "@/components/ui";
import { Markdown } from "@/components/app/markdown";
import { useToast } from "@/components/app/toast";
import { ask, clearChat } from "../actions";

type Msg = { id: string; role: "user" | "assistant"; content: string; refs: { label: string; kind?: string; quote?: string | null }[]; followUps: string[] };

const STARTERS = ["Why is my top action ranked first?", "Which bet has the weakest evidence?", "What do lost deals have in common?", "Draft a one-line pitch for my ICP"];

export function AskChat({ messages, paused, initialQuestion }: { messages: Msg[]; paused: boolean; initialQuestion: string }) {
  const [text, setText] = useState(initialQuestion);
  const [pending, start] = useTransition();
  const [opt, addOpt] = useOptimistic<Msg[], string>(messages, (s, q) => [...s, { id: `tmp-${s.length}`, role: "user", content: q, refs: [], followUps: [] }]);
  const toast = useToast();
  const router = useRouter();
  const end = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [opt.length, pending]);
  useEffect(() => {
    ta.current?.focus();
  }, []);

  const send = (q: string) => {
    const question = q.trim();
    if (!question || pending) return;
    setText("");
    start(async () => {
      addOpt(question);
      const r = await ask(question);
      if (!r.ok) {
        setText(question);
        toast({ message: r.error, tone: "error" });
      }
      router.refresh();
    });
  };

  const last = opt[opt.length - 1];
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-140px)] max-w-[820px] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Ask Oryn</h1>
        {opt.length ? <Button size="sm" variant="ghost" onClick={() => { if (confirm("Clear this conversation?")) start(async () => { await clearChat(); router.refresh(); }); }}>Clear</Button> : null}
      </div>

      {!opt.length ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <AgentMark size={56} />
          <h2 className="mt-5 text-[28px] font-semibold tracking-[-0.025em]">What do you want to know?</h2>
          <p className="mt-2 max-w-md text-[15px] text-fg-2">Oryn answers from your Company Brain, CRM data and documents — and shows its sources.</p>
          <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
            {STARTERS.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={paused || pending} className="rounded-full border border-border bg-surface px-3.5 py-2 text-[13.5px] text-fg-2 transition-colors hover:border-brand-border hover:bg-brand-soft hover:text-brand-text disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-5 pb-6" aria-live="polite">
          {opt.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink-900 px-4 py-3 text-[14.5px] text-white">{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <AgentMark size={28} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3.5 shadow-e1">
                  <Markdown text={m.content} />
                  {m.refs.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                      {m.refs.map((r, i) => <SourceChip key={i} label={r.label} kind={r.kind} />)}
                    </div>
                  ) : null}
                  {m === last && m.followUps.length && !pending ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {m.followUps.map((f) => (
                        <button key={f} onClick={() => send(f)} className="rounded-full border border-border px-3 py-1.5 text-[12.5px] text-fg-2 hover:border-brand-border hover:text-brand-text">{f}</button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          )}
          {pending ? (
            <div className="flex gap-3">
              <AgentMark size={28} className="shrink-0" />
              <div className="rounded-2xl border border-border bg-surface px-4 py-3"><Thinking label="Reading your Brain and sources…" /></div>
            </div>
          ) : null}
          <div ref={end} />
        </div>
      )}

      <form
        className="ai-ring sticky bottom-4 rounded-2xl bg-surface p-2 shadow-e3"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <textarea
          ref={ta}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(text);
            }
          }}
          rows={2}
          maxLength={1500}
          disabled={paused}
          placeholder={paused ? "Oryn is paused. Resume it in Settings to ask questions." : "Ask about your deals, bets, Brain or this week…"}
          aria-label="Your question"
          className="block w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-ink-400"
        />
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[12px] text-fg-3"><Kbd>Enter</Kbd> to send · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> new line</span>
          <Button type="submit" size="sm" variant="ai" disabled={!text.trim() || paused} loading={pending}>Ask</Button>
        </div>
      </form>
    </div>
  );
}
