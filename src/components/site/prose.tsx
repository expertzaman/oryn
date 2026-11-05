export function Prose({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated?: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-[760px] px-5 py-20 sm:px-8 sm:py-24">
      <p className="overline !text-brand-text">{eyebrow}</p>
      <h1 className="mt-3 text-[38px] font-semibold tracking-[-0.03em] sm:text-[46px]">{title}</h1>
      {updated ? <p className="mt-3 text-[14px] text-fg-3">Last updated {updated}</p> : null}
      <div className="mt-10 space-y-8 text-[16px] leading-[1.7] text-fg-2 [&_h2]:mb-3 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2">
        {children}
      </div>
    </article>
  );
}
