import * as React from "react";
import clsx from "clsx";
import Link from "next/link";

export const cn = (...a: Parameters<typeof clsx>) => clsx(...a);

/* ---------- Logo ---------- */
export function AgentMark({ size = 28, className }: { size?: number; className?: string }) {
  // Gradient is painted with CSS (not an SVG <defs> id) so the mark renders even when
  // another copy lives inside a hidden element.
  return (
    <span aria-hidden className={cn("relative inline-grid shrink-0 place-items-center rounded-full bg-sunrise", className)} style={{ width: size, height: size, backgroundImage: "linear-gradient(42deg, #FF6A1F 0%, #FFA36E 55%, #FFC46B 100%)" }}>
      <svg width={size} height={size} viewBox="0 0 51 51" fill="none" className="absolute inset-0">
        <path d="M11.46 38.74C13.12 31.31 18.66 27.28 25.3 27.28C31.94 27.28 37.48 31.31 39.14 38.74" stroke="white" strokeWidth="4.74" strokeLinecap="round" />
        <circle cx="25.3" cy="17.79" r="5.93" fill="white" />
      </svg>
    </span>
  );
}

export function Logo({ size = 28, href = "/", className }: { size?: number; href?: string | null; className?: string }) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <AgentMark size={size} />
      <span className="text-[19px] font-semibold tracking-[-0.03em] text-fg">oryn</span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} aria-label="Oryn home" className="rounded-md">
      {inner}
    </Link>
  );
}

/* ---------- Button ---------- */
type Variant = "primary" | "brand" | "secondary" | "ghost" | "danger" | "ai";
type Size = "sm" | "md" | "lg";
const variants: Record<Variant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-700 shadow-e1",
  brand: "bg-brand text-white hover:bg-ember-600 shadow-e1",
  secondary: "bg-surface text-fg border border-border-strong hover:bg-subtle",
  ghost: "text-fg-2 hover:bg-subtle hover:text-fg",
  danger: "bg-danger text-white hover:bg-[#a81f1f]",
  ai: "bg-sunrise text-white shadow-e1 hover:brightness-[1.04]",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-md",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-lg",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background,color,box-shadow,filter] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className={variant === "secondary" || variant === "ghost" ? "text-fg-2" : "text-white"} /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  icon,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode; icon?: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href">) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors", variants[variant], sizes[size], className)}
      {...rest}
    >
      {icon}
      {children}
    </Link>
  );
}

export function Spinner({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn("animate-spin", className)} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/* ---------- Surfaces ---------- */
export function Card({ className, children, as: As = "div", ...rest }: React.HTMLAttributes<HTMLDivElement> & { as?: React.ElementType }) {
  return (
    <As className={cn("rounded-xl border border-border bg-surface shadow-e1", className)} {...rest}>
      {children}
    </As>
  );
}

export function SectionHeader({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {sub ? <p className="mt-0.5 text-[13px] text-fg-3">{sub}</p> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function PageHeader({ title, sub, right, back }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6">
      {back ? (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-fg-3 hover:text-fg">
          <span aria-hidden>←</span> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-fg sm:text-[28px]">{title}</h1>
          {sub ? <p className="mt-1.5 max-w-2xl text-[15px] text-fg-2">{sub}</p> : null}
        </div>
        {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
      </div>
    </header>
  );
}

/* ---------- Badges ---------- */
type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-fg-2 border-border",
  brand: "bg-brand-soft text-brand-text border-brand-border",
  success: "bg-success-soft text-success border-[#c8eadb]",
  warning: "bg-warning-soft text-warning border-[#f4dfb8]",
  danger: "bg-danger-soft text-danger border-[#f6cccc]",
  info: "bg-info-soft text-info border-[#cfe5fa]",
};
export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-medium", tones[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export type EvidenceLevel = "supported" | "weak" | "assumed";
export function EvidenceBadge({ level, count }: { level: EvidenceLevel; count?: string | number | null }) {
  const map = {
    supported: { tone: "success" as Tone, label: "Supported", bars: 3 },
    weak: { tone: "warning" as Tone, label: "Weak", bars: 2 },
    assumed: { tone: "neutral" as Tone, label: "Assumed", bars: 1 },
  }[level] ?? { tone: "neutral" as Tone, label: "Assumed", bars: 1 };
  return (
    <span
      className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-medium", tones[map.tone])}
      title={`Evidence: ${map.label}${count ? ` · ${count}` : ""}`}
    >
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("w-[3px] rounded-sm bg-current", i < map.bars ? "opacity-100" : "opacity-25")} style={{ height: 5 + i * 2 }} />
        ))}
      </span>
      {map.label}
      {count ? <span className="opacity-80">· {count}</span> : null}
    </span>
  );
}

const levelNames = ["Observe", "Recommend", "Draft", "Approve & run", "Act within limits", "Owned scope"];
export function AutonomyChip({ level, state = "current" }: { level: number; state?: "current" | "available" | "locked" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium",
        state === "current" && "bg-ink-900 text-white",
        state === "available" && "border border-brand-border bg-brand-soft text-brand-text",
        state === "locked" && "border border-border bg-subtle text-fg-3",
      )}
    >
      <span className="font-semibold">L{level}</span>
      {levelNames[level] ?? ""}
    </span>
  );
}

export function SourceChip({ label, kind }: { label: string; kind?: string }) {
  const icon = { website: "◎", document: "▤", notes: "✎", crm: "◆", conversation: "◌", learning: "✦" }[kind ?? ""] ?? "▤";
  return (
    <span className="inline-flex h-6 max-w-[260px] items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-[12px] text-fg-2">
      <span aria-hidden className="text-fg-3">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

/* ---------- Forms ---------- */
export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px] font-medium text-fg">
      <span>{children}</span>
      {hint ? <span className="text-[12px] font-normal text-fg-3">{hint}</span> : null}
    </label>
  );
}

const fieldBase =
  "w-full rounded-md border bg-surface px-3 text-[14px] text-fg placeholder:text-ink-400 transition-[border,box-shadow] outline-none focus:border-brand focus:shadow-focus disabled:cursor-not-allowed disabled:bg-subtle";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(fieldBase, "h-10", invalid ? "border-danger" : "border-border-strong", className)} {...rest} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { className, invalid, ...rest },
  ref,
) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(fieldBase, "min-h-[96px] py-2.5 leading-relaxed", invalid ? "border-danger" : "border-border-strong", className)} {...rest} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, "h-10 appearance-none border-border-strong bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b6b78' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
});

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-[12.5px] text-danger">
      {children}
    </p>
  );
}

export function Alert({ tone = "info", title, children, action }: { tone?: Tone; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-[13.5px]", tones[tone])}>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "text-fg-2")}>{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value, tone = "brand", className, label }: { value: number; tone?: "brand" | "success" | "warning" | "ai"; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-subtle", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", tone === "brand" && "bg-brand", tone === "success" && "bg-success", tone === "warning" && "bg-[#e08a1e]", tone === "ai" && "bg-sunrise")}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-brand-soft text-brand-text">{icon ?? <AgentMark size={28} />}</div>
      <h3 className="text-[16px] font-semibold text-fg">{title}</h3>
      {children ? <p className="mt-1.5 max-w-md text-[14px] text-fg-2">{children}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Thinking({ label = "Oryn is thinking" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-fg-2" role="status" aria-live="polite">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="thinking-dot size-1.5 rounded-full bg-brand" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      {label}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "brand" | "success" | "warning" | "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="overline">{label}</p>
      <p className={cn("num mt-1.5 text-[22px] font-semibold tracking-[-0.02em]", tone === "brand" && "text-brand-text", tone === "success" && "text-success", tone === "warning" && "text-warning", tone === "danger" && "text-danger")}>{value}</p>
      {sub ? <p className="mt-0.5 text-[12.5px] text-fg-3">{sub}</p> : null}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-border bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-fg-3">{children}</kbd>;
}
