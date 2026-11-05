import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full bg-brand opacity-30 blur-[140px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-24 size-[420px] rounded-full bg-sky-500 opacity-15 blur-[140px]" />
        <div className="relative">
          <span className="inline-flex items-center gap-2.5">
            <Logo href="/" className="[&_span]:text-white" />
          </span>
        </div>
        <div className="relative mt-auto max-w-[460px]">
          <p className="overline !text-ember-300">Navigate by signal</p>
          <h2 className="mt-4 text-[40px] font-semibold leading-[1.08] tracking-[-0.03em]">Three actions that move your goal. Every Monday.</h2>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-300">
            Oryn reads your website, CRM history and sales notes, finds the bottleneck, and shows the evidence behind every recommendation.
          </p>
          <ul className="mt-8 space-y-3 text-[14px] text-ink-200">
            {["Every claim linked to its source", "Nothing leaves without your approval", "Export or delete your data anytime"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-5 place-items-center rounded-full bg-white/10 text-[11px] text-ember-300">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-[12.5px] text-ink-400">© {new Date().getFullYear()} Oryn</p>
      </aside>
      <main className="flex min-h-dvh flex-col bg-surface px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
