"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AgentMark, Logo, cn } from "@/components/ui";

type Counts = { week: number; proposals: number; drafts: number };

const I = {
  week: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  goals: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  brain: "M9 4a3 3 0 0 0-3 3v.2A3 3 0 0 0 4 10a3 3 0 0 0 1 2.2A3 3 0 0 0 7 17a3 3 0 0 0 5 1.5V5.5A3 3 0 0 0 9 4Zm6 0a3 3 0 0 1 3 3v.2A3 3 0 0 1 20 10a3 3 0 0 1-1 2.2A3 3 0 0 1 17 17a3 3 0 0 1-5 1.5",
  learn: "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zm0 16V5m4 2h6",
  drafts: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zm0 0v5h5M9 13h6M9 17h4",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  ask: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
};

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

const NAV: { href: string; label: string; icon: keyof typeof I; count?: keyof Counts }[] = [
  { href: "/app", label: "This Week", icon: "week", count: "week" },
  { href: "/app/goals", label: "Goals & Bets", icon: "goals" },
  { href: "/app/brain", label: "Company Brain", icon: "brain", count: "proposals" },
  { href: "/app/learnings", label: "Learnings", icon: "learn" },
  { href: "/app/drafts", label: "Drafts", icon: "drafts", count: "drafts" },
  { href: "/app/activity", label: "Activity", icon: "activity" },
];

function isActive(path: string, href: string) {
  if (href === "/app") return path === "/app" || path.startsWith("/app/actions");
  if (href === "/app/goals") return path.startsWith("/app/goals") || path.startsWith("/app/bets");
  return path.startsWith(href);
}

export function AppShell({ children, user, company, counts, paused, signOut }: { children: React.ReactNode; user: { name: string; email: string }; company: string; counts: Counts; paused: boolean; signOut: () => Promise<void> }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/app/ask");
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

  const sidebar = (
    <div className="flex h-full flex-col gap-1 px-3 py-4">
      <div className="flex items-center justify-between px-2 pb-3">
        <Logo href="/app" />
      </div>
      <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-border bg-canvas px-3 py-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink-900 text-[11px] font-semibold text-white">{company.slice(0, 2).toUpperCase()}</span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">{company}</span>
          <span className="block text-[11.5px] text-fg-3">Founder plan</span>
        </span>
      </div>
      <p className="overline px-2 pb-1 pt-2">Workspace</p>
      <nav aria-label="App" className="flex flex-col gap-0.5">
        {NAV.map((n) => {
          const active = isActive(path, n.href);
          const c = n.count ? counts[n.count] : 0;
          return (
            <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors", active ? "bg-brand-soft font-medium text-brand-text" : "text-fg-2 hover:bg-subtle hover:text-fg")}>
              <Icon d={I[n.icon]} className={active ? "text-brand" : "text-fg-3"} />
              <span className="flex-1">{n.label}</span>
              {c ? <span className={cn("num min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5", active ? "bg-brand text-white" : "bg-subtle text-fg-2")}>{c}</span> : null}
            </Link>
          );
        })}
      </nav>
      <Link href="/app/ask" className={cn("mt-3 flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[14px]", path.startsWith("/app/ask") ? "bg-brand-soft font-medium text-brand-text" : "text-fg-2 hover:bg-subtle")}>
        <AgentMark size={18} />
        <span className="flex-1">Ask Oryn</span>
        <span className="text-[11px] text-fg-3">⌘K</span>
      </Link>
      <div className="flex-1" />
      <Link href="/app/settings" className={cn("flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[14px]", path.startsWith("/app/settings") ? "bg-brand-soft font-medium text-brand-text" : "text-fg-2 hover:bg-subtle")}>
        <Icon d={I.settings} className="text-fg-3" />
        Settings
      </Link>
      <Link href="/app/settings/pause" className={cn("flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[14px] font-medium", paused ? "bg-warning-soft text-warning" : "text-danger hover:bg-danger-soft")}>
        <span aria-hidden className="w-[18px] text-center">{paused ? "▶" : "❚❚"}</span>
        {paused ? "Paused — resume" : "Global pause"}
      </Link>
      <div className="mt-2 flex items-center gap-2.5 border-t border-border px-2 pt-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ember-100 text-[12px] font-semibold text-brand-text">{initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{user.name}</span>
          <span className="block truncate text-[11.5px] text-fg-3">{user.email}</span>
        </span>
        <button onClick={() => start(() => signOut())} className="rounded-md px-2 py-1 text-[12px] text-fg-3 hover:bg-subtle hover:text-fg" title="Sign out">
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas lg:pl-[256px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[256px] border-r border-border bg-surface lg:block">{sidebar}</aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] overflow-y-auto bg-surface shadow-e4">{sidebar}</aside>
        </div>
      ) : null}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open navigation" className="grid size-9 place-items-center rounded-md hover:bg-subtle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <Logo href="/app" size={24} />
        <Link href="/app/ask" className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] text-fg-2">
          <AgentMark size={16} /> Ask
        </Link>
      </div>
      {paused ? (
        <div className="border-b border-[#f4dfb8] bg-warning-soft px-5 py-2.5 text-center text-[13.5px] text-warning">
          Oryn is paused — no new briefs or drafts are generated. <Link href="/app/settings/pause" className="font-semibold underline underline-offset-2">Resume</Link>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
