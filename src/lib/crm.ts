import Papa from "papaparse";

export type ParsedDeal = {
  name: string;
  company: string | null;
  stage: string | null;
  status: "open" | "won" | "lost";
  amount: number | null;
  createdOn: string | null;
  closeDate: string | null;
  lostReason: string | null;
  notes: string | null;
};

export type CsvResult = { deals: ParsedDeal[]; mapping: Record<string, string | null>; skipped: number; total: number; warnings: string[] };

const ALIASES: Record<keyof Omit<ParsedDeal, "status">, string[]> = {
  name: ["deal name", "deal", "opportunity name", "opportunity", "name", "title", "deal title"],
  company: ["company", "company name", "associated company", "account", "account name", "organization", "organisation"],
  stage: ["deal stage", "stage", "pipeline stage", "status", "opportunity stage", "stage name"],
  amount: ["amount", "deal value", "value", "deal amount", "arr", "acv", "mrr", "revenue", "total value"],
  createdOn: ["create date", "created", "created at", "created date", "date created", "deal created"],
  closeDate: ["close date", "closed date", "expected close date", "closed at", "won time", "lost time", "close"],
  lostReason: ["closed lost reason", "lost reason", "reason lost", "loss reason", "closed won reason", "reason"],
  notes: ["notes", "description", "next step", "deal description", "comments", "note"],
};

const norm = (s: string) => s.toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();

export function detectMapping(headers: string[]) {
  const mapping: Record<string, string | null> = {};
  const used = new Set<string>();
  for (const [field, aliases] of Object.entries(ALIASES)) {
    let hit: string | null = null;
    for (const a of aliases) {
      hit = headers.find((h) => !used.has(h) && norm(h) === a) ?? null;
      if (hit) break;
    }
    if (!hit) {
      for (const a of aliases) {
        hit = headers.find((h) => !used.has(h) && norm(h).includes(a)) ?? null;
        if (hit) break;
      }
    }
    if (hit) used.add(hit);
    mapping[field] = hit;
  }
  return mapping;
}

export function parseAmount(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  let cleaned = s.replace(/[^\d.,kKmM]/g, "");
  let mult = 1;
  if (/k$/i.test(cleaned)) { mult = 1e3; cleaned = cleaned.slice(0, -1); }
  else if (/m$/i.test(cleaned)) { mult = 1e6; cleaned = cleaned.slice(0, -1); }
  // 1.234,56 (EU) vs 1,234.56 (US)
  if (/\d\.\d{3},\d{1,2}$/.test(cleaned)) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  else cleaned = cleaned.replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return (neg ? -1 : 1) * n * mult;
}

export function parseDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
  if (m) {
    let [a, b, y] = [+m[1], +m[2], +m[3]];
    if (y < 100) y += 2000;
    // Prefer US order unless impossible
    if (a > 12) [a, b] = [b, a];
    return iso(y, a, b);
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1990) return d.toISOString().slice(0, 10);
  return null;
}

function iso(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function statusFromStage(stage: string | null): ParsedDeal["status"] {
  const s = (stage || "").toLowerCase();
  if (/closed\s*won|\bwon\b|signed|customer/.test(s)) return "won";
  if (/closed\s*lost|\blost\b|disqualified|churn|dead/.test(s)) return "lost";
  return "open";
}

const clip = (v: unknown, n: number) => {
  const s = v == null ? "" : String(v).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, n) : null;
};

export function parseCrmCsv(text: string, maxRows = 5000): CsvResult {
  const warnings: string[] = [];
  const clean = text.replace(/^﻿/, "");
  const res = Papa.parse<Record<string, string>>(clean, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  const headers = (res.meta.fields ?? []).filter(Boolean);
  if (!headers.length) return { deals: [], mapping: {}, skipped: 0, total: 0, warnings: ["The file has no header row."] };
  const mapping = detectMapping(headers);
  if (!mapping.name && !mapping.company) warnings.push("Couldn’t find a deal name or company column.");
  if (!mapping.stage) warnings.push("Couldn’t find a stage column — every deal will be treated as open.");
  const rows = res.data;
  if (rows.length > maxRows) warnings.push(`Only the first ${maxRows.toLocaleString()} rows were imported.`);
  const deals: ParsedDeal[] = [];
  let skipped = 0;
  for (const r of rows.slice(0, maxRows)) {
    const get = (f: string) => (mapping[f] ? r[mapping[f] as string] : undefined);
    const name = clip(get("name"), 200) ?? clip(get("company"), 200);
    if (!name) {
      skipped++;
      continue;
    }
    const stage = clip(get("stage"), 80);
    deals.push({
      name,
      company: clip(get("company"), 200),
      stage,
      status: statusFromStage(stage),
      amount: parseAmount(get("amount")),
      createdOn: parseDate(get("createdOn")),
      closeDate: parseDate(get("closeDate")),
      lostReason: clip(get("lostReason"), 300),
      notes: clip(get("notes"), 1200),
    });
  }
  if (res.errors.length > 0 && deals.length === 0) warnings.push("The file couldn’t be read as CSV.");
  return { deals, mapping, skipped, total: rows.length, warnings };
}

/* ---------------- Stats ---------------- */
export type DealStats = {
  total: number;
  won: number;
  lost: number;
  open: number;
  winRate: number | null;
  avgWon: number | null;
  medianCycleDays: number | null;
  topLossReasons: { reason: string; count: number }[];
  stageCounts: { stage: string; count: number }[];
  stalledOpen: number;
};

const STOP = new Set(["the", "a", "an", "to", "of", "and", "for", "too", "was", "is", "no", "not", "they", "we", "our", "it", "in", "on", "with"]);

export function canonicalReason(r: string) {
  const s = r.toLowerCase();
  if (/price|budget|expensive|cost/.test(s)) return "Price / budget";
  if (/compet|chose|went with|vendor/.test(s)) return "Chose a competitor";
  if (/in.?house|internal|built|bi\b|spreadsheet|excel/.test(s)) return "Built in-house / internal tool";
  if (/timing|later|next year|not now|priority|priorit/.test(s)) return "Timing / not a priority";
  if (/value|unclear|roi|didn.?t see|not convinced/.test(s)) return "Unclear value / ROI";
  if (/feature|missing|integrat|capabil/.test(s)) return "Missing feature / integration";
  if (/ghost|no response|unresponsive|went dark|silent/.test(s)) return "Went silent";
  if (/champion|left|reorg/.test(s)) return "Champion left / reorg";
  const words = s.split(/[^a-z]+/).filter((w) => w && !STOP.has(w)).slice(0, 4);
  return words.length ? words.join(" ").replace(/^\w/, (c) => c.toUpperCase()) : "Unspecified";
}

export function computeStats(deals: (Pick<ParsedDeal, "amount" | "createdOn" | "closeDate" | "lostReason" | "stage"> & { status: string })[], today = new Date()): DealStats {
  const won = deals.filter((d) => d.status === "won");
  const lost = deals.filter((d) => d.status === "lost");
  const open = deals.filter((d) => d.status === "open");
  const closed = won.length + lost.length;
  const amounts = won.map((d) => d.amount).filter((n): n is number => typeof n === "number" && n > 0);
  const cycles = won
    .map((d) => (d.createdOn && d.closeDate ? (Date.parse(d.closeDate) - Date.parse(d.createdOn)) / 864e5 : NaN))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  const reasons = new Map<string, number>();
  for (const d of lost) {
    if (!d.lostReason) continue;
    const k = canonicalReason(d.lostReason);
    reasons.set(k, (reasons.get(k) ?? 0) + 1);
  }
  const stages = new Map<string, number>();
  for (const d of open) {
    const k = d.stage || "Unknown stage";
    stages.set(k, (stages.get(k) ?? 0) + 1);
  }
  const stalledOpen = open.filter((d) => d.createdOn && (today.getTime() - Date.parse(d.createdOn)) / 864e5 > 45).length;
  return {
    total: deals.length,
    won: won.length,
    lost: lost.length,
    open: open.length,
    winRate: closed ? won.length / closed : null,
    avgWon: amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : null,
    medianCycleDays: cycles.length ? Math.round(cycles[Math.floor(cycles.length / 2)]) : null,
    topLossReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    stageCounts: [...stages.entries()].map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    stalledOpen,
  };
}

export function statsSummary(s: DealStats) {
  if (!s.total) return "No CRM deals imported yet.";
  const pct = (n: number | null) => (n == null ? "n/a" : `${Math.round(n * 100)}%`);
  const lines = [
    `${s.total} deals: ${s.won} won, ${s.lost} lost, ${s.open} open. Win rate ${pct(s.winRate)}.`,
    s.avgWon ? `Average won deal ${Math.round(s.avgWon).toLocaleString("en-US")}.` : "",
    s.medianCycleDays != null ? `Median sales cycle ${s.medianCycleDays} days.` : "",
    s.topLossReasons.length ? `Top loss reasons: ${s.topLossReasons.map((r) => `${r.reason} (${r.count})`).join(", ")}.` : "No loss reasons recorded.",
    s.stageCounts.length ? `Open pipeline by stage: ${s.stageCounts.map((r) => `${r.stage} (${r.count})`).join(", ")}.` : "",
    s.stalledOpen ? `${s.stalledOpen} open deals are older than 45 days.` : "",
  ];
  return lines.filter(Boolean).join(" ");
}
