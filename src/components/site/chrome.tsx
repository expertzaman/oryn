import Link from "next/link";
import { ButtonLink, Logo } from "@/components/ui";
import { MobileNav } from "./mobile-nav";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-5 sm:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-[14px] text-fg-2 transition-colors hover:bg-subtle hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <ButtonLink href="/app" variant="primary" size="sm">
              Open app →
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/sign-in" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/sign-up" variant="primary" size="sm">
                Start free
              </ButtonLink>
            </>
          )}
        </div>
        <MobileNav nav={NAV} signedIn={signedIn} />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-[300px] text-[14px] leading-relaxed text-fg-3">Growth intelligence for B2B SaaS founders. Three actions a week, every claim sourced.</p>
        </div>
        {[
          { h: "Product", l: [["How it works", "/#how"], ["Features", "/#product"], ["Pricing", "/pricing"]] },
          { h: "Company", l: [["Security", "/security"], ["Privacy", "/privacy"], ["Terms", "/terms"]] },
          { h: "Get started", l: [["Create account", "/sign-up"], ["Sign in", "/sign-in"]] },
        ].map((c) => (
          <div key={c.h}>
            <p className="text-[13px] font-semibold text-fg">{c.h}</p>
            <ul className="mt-3 space-y-2.5">
              {c.l.map(([t, h]) => (
                <li key={h}>
                  <Link href={h} className="text-[14px] text-fg-3 hover:text-fg">
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-[13px] text-fg-3 sm:px-8">
          <p>© {new Date().getFullYear()} Oryn. All rights reserved.</p>
          <p>Navigate by signal.</p>
        </div>
      </div>
    </footer>
  );
}
