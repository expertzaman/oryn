import Link from "next/link";
import { AutonomyChip, Badge, Card, EvidenceBadge, Progress, SourceChip, cn, type EvidenceLevel } from "@/components/ui";

export function fmtDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00Z" : d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(date);
}

export function timeAgo(d: Date) {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(d);
}

export type ActionRow = {
  id: string;
  rank: number;
  title: string;
  why: string;
  effort: string | null;
  impact: string;
  autonomy: number;
  evidence: EvidenceLevel;
  evidenceCount: string | null;
  refs: { label: string; kind?: string }[];
  status: string;
  betTitle?: string | null;
};

export function ActionCard({ a, controls }: { a: ActionRow; controls?: React.ReactNode }) {
  const done = a.status !== "open";
  const statusBadge = { done: <Badge tone="success">✓ Done</Badge>, skipped: <Badge>Skipped</Badge>, disagreed: <Badge tone="warning">You disagreed</Badge> }[a.status as "done"];
  return (
    <Card className={cn("p-5 transition-shadow sm:p-6", !done && "hover:shadow-e2", done && "bg-surface/70")}>
      <div className="flex gap-4">
        <span className={cn("num grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-semibold", a.status === "done" ? "bg-success-soft text-success" : done ? "bg-subtle text-fg-3" : "bg-brand-soft text-brand-text")}>{a.status === "done" ? "✓" : a.rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <Link href={`/app/actions/${a.id}`} className={cn("text-[16.5px] font-semibold leading-snug tracking-[-0.01em] hover:text-brand-text", done && "text-fg-2")}>
              {a.title}
            </Link>
            {statusBadge ?? <Badge tone={a.impact === "high" ? "brand" : "neutral"}>{a.impact.charAt(0).toUpperCase() + a.impact.slice(1)} impact</Badge>}
          </div>
          <p className={cn("mt-1.5 text-[14.5px] leading-relaxed", done ? "text-fg-3" : "text-fg-2")}>{a.why}</p>
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            <AutonomyChip level={a.autonomy} />
            <EvidenceBadge level={a.evidence} count={a.evidenceCount} />
            {a.betTitle ? <Badge>Bet · {a.betTitle}</Badge> : null}
            {a.effort ? <Badge>{a.effort}</Badge> : null}
          </div>
          {a.refs.length ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="overline mr-1">Sources</span>
              {a.refs.slice(0, 3).map((r, i) => (
                <SourceChip key={i} label={r.label} kind={r.kind} />
              ))}
            </div>
          ) : null}
          {controls ? <div className="mt-4 border-t border-border pt-4">{controls}</div> : null}
        </div>
      </div>
    </Card>
  );
}

export function BetMini({ b }: { b: { id: string; title: string; status: string; startedAt: Date | null; endsAt: Date | null; durationDays: number; metric: string } }) {
  const total = b.durationDays;
  const day = b.startedAt ? Math.min(total, Math.max(1, Math.floor((Date.now() - b.startedAt.getTime()) / 864e5) + 1)) : 0;
  const over = b.endsAt ? b.endsAt.getTime() < Date.now() : false;
  return (
    <Link href={`/app/bets/${b.id}`} className="block rounded-lg border border-border bg-canvas p-3.5 transition-colors hover:border-border-strong">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[14px] font-medium">{b.title}</p>
        {over ? <Badge tone="warning">Time’s up</Badge> : b.status === "paused" ? <Badge>Paused</Badge> : <Badge tone="success" dot>Running</Badge>}
      </div>
      <Progress value={(day / total) * 100} className="mt-2.5" tone={over ? "warning" : "brand"} label={`${b.title} progress`} />
      <div className="mt-2 flex justify-between text-[12px] text-fg-3">
        <span className="num">{b.startedAt ? `Day ${day} of ${total}` : "Not started"}</span>
        <span className="truncate pl-3">{b.metric}</span>
      </div>
    </Link>
  );
}

export function RailCard({ title, sub, right, children }: { title: string; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold">{title}</p>
          {sub ? <p className="text-[12.5px] text-fg-3">{sub}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}
