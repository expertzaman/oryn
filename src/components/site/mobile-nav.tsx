"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav({ nav, signedIn }: { nav: { href: string; label: string }[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="ml-auto md:hidden">
      <button type="button" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)} className="grid size-10 place-items-center rounded-md text-fg hover:bg-subtle">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open ? (
        <div id="mobile-menu" className="fixed inset-x-0 top-16 bottom-0 z-50 overflow-y-auto border-t border-border bg-white px-5 py-6">
          <nav aria-label="Mobile" className="flex flex-col">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="border-b border-border py-4 text-[17px] font-medium text-fg">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 grid gap-3">
            {signedIn ? (
              <Link href="/app" className="flex h-12 items-center justify-center rounded-lg bg-ink-900 text-[15px] font-medium text-white">
                Open app
              </Link>
            ) : (
              <>
                <Link href="/sign-up" className="flex h-12 items-center justify-center rounded-lg bg-ink-900 text-[15px] font-medium text-white">
                  Start free
                </Link>
                <Link href="/sign-in" className="flex h-12 items-center justify-center rounded-lg border border-border-strong text-[15px] font-medium text-fg">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
