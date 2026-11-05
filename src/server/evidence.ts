import "server-only";
import { and, eq } from "drizzle-orm";
import { schema, type DB } from "./db";
import { computeStats, parseCrmCsv, statsSummary } from "@/lib/crm";
import { DocumentError, extractText } from "./ingest/document";
import { buildCtx, logActivity, type Workspace } from "./service";
import { proposeUpdates } from "./ai/tasks";

export type AddResult = { ok: true; added: { id: string; title: string; kind: string; detail: string }[]; warnings: string[]; proposals: number } | { ok: false; error: string };

const MAX_SOURCES = 60;

function crmContent(title: string, deals: ReturnType<typeof parseCrmCsv>["deals"]) {
  const s = computeStats(deals);
  const lostNotes = deals
    .filter((d) => d.status === "lost" && (d.lostReason || d.notes))
    .slice(0, 40)
    .map((d) => `- ${d.name}${d.amount ? ` ($${Math.round(d.amount).toLocaleString("en-US")})` : ""}: ${d.lostReason ?? ""}${d.notes ? ` — ${d.notes.slice(0, 160)}` : ""}`);
  const wonNotes = deals
    .filter((d) => d.status === "won" && d.notes)
    .slice(0, 15)
    .map((d) => `- ${d.name}: ${d.notes!.slice(0, 160)}`);
  return [`${title}. ${statsSummary(s)}`, lostNotes.length ? `Lost deals with reasons:\n${lostNotes.join("\n")}` : "", wonNotes.length ? `Won deal notes:\n${wonNotes.join("\n")}` : ""].filter(Boolean).join("\n\n");
}

export async function addEvidence(db: DB, ws: Workspace, input: { files: File[]; notes?: string; notesTitle?: string }): Promise<AddResult> {
  const existing = await db.select({ id: schema.sources.id }).from(schema.sources).where(eq(schema.sources.workspaceId, ws.id));
  const files = input.files.filter((f) => f && typeof f === "object" && "size" in f && f.size > 0);
  const notes = (input.notes ?? "").trim();
  if (!files.length && !notes) return { ok: false, error: "Choose a file or paste some notes first." };
  if (existing.length + files.length + (notes ? 1 : 0) > MAX_SOURCES) return { ok: false, error: `A workspace can hold up to ${MAX_SOURCES} sources. Delete some old ones first.` };
  if (files.length > 10) return { ok: false, error: "Upload up to 10 files at a time." };

  const added: { id: string; title: string; kind: string; detail: string }[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    try {
      const { kind, text } = await extractText(file);
      const base = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Upload";
      if (kind === "csv") {
        const parsed = parseCrmCsv(text);
        if (!parsed.deals.length) {
          warnings.push(`${file.name}: ${parsed.warnings[0] ?? "no deals found"}.`);
          continue;
        }
        const title = `CRM export · ${parsed.deals.length.toLocaleString("en-US")} deals`;
        const [src] = await db
          .insert(schema.sources)
          .values({ workspaceId: ws.id, kind: "crm", title: `${title} (${base})`.slice(0, 120), content: crmContent(title, parsed.deals), meta: { file: file.name, mapping: parsed.mapping, skipped: parsed.skipped, total: parsed.total } })
          .returning({ id: schema.sources.id, title: schema.sources.title });
        for (let i = 0; i < parsed.deals.length; i += 500) {
          await db.insert(schema.deals).values(parsed.deals.slice(i, i + 500).map((d) => ({ ...d, workspaceId: ws.id, sourceId: src.id })));
        }
        parsed.warnings.forEach((w) => warnings.push(`${file.name}: ${w}`));
        if (parsed.skipped) warnings.push(`${file.name}: skipped ${parsed.skipped} rows without a deal or company name.`);
        const st = computeStats(parsed.deals);
        added.push({ id: src.id, title: src.title, kind: "crm", detail: `${st.won} won · ${st.lost} lost · ${st.open} open` });
      } else {
        const [src] = await db
          .insert(schema.sources)
          .values({ workspaceId: ws.id, kind: "document", title: base, content: text, meta: { file: file.name, chars: text.length } })
          .returning({ id: schema.sources.id, title: schema.sources.title });
        added.push({ id: src.id, title: src.title, kind: "document", detail: `${Math.round(text.length / 1000)}k characters read` });
      }
    } catch (e) {
      warnings.push(e instanceof DocumentError ? e.message : `${file.name}: couldn’t be read.`);
      if (!(e instanceof DocumentError)) console.error(e);
    }
  }

  if (notes) {
    if (notes.length < 20) warnings.push("Notes need at least a sentence or two to be useful.");
    else {
      const title = (input.notesTitle?.trim() || notes.split("\n")[0]).slice(0, 80) || "Notes";
      const [src] = await db.insert(schema.sources).values({ workspaceId: ws.id, kind: "notes", title, content: notes.slice(0, 60_000) }).returning({ id: schema.sources.id, title: schema.sources.title });
      added.push({ id: src.id, title: src.title, kind: "notes", detail: `${notes.length.toLocaleString("en-US")} characters` });
    }
  }

  if (!added.length) return { ok: false, error: warnings[0] ?? "Nothing could be added." };
  for (const a of added) await logActivity(db, ws.id, "you", "source", `Added ${a.kind === "crm" ? "CRM export" : a.kind}: ${a.title}`, a.detail, "/app/settings/data");

  let proposals = 0;
  if (ws.stage === "active") {
    try {
      const ctx = await buildCtx(db, ws);
      for (const a of added.slice(0, 2)) {
        const fresh = ctx.excerpts.find((e) => e.sourceId === a.id);
        if (!fresh) continue;
        const { data } = await proposeUpdates(ctx, fresh);
        if (data.length) {
          await db.insert(schema.proposals).values(data.map((p) => ({ workspaceId: ws.id, kind: p.factId ? "update" : "add", ...p })));
          proposals += data.length;
        }
      }
      if (proposals) await logActivity(db, ws.id, "oryn", "proposal", `${proposals} Brain proposal${proposals > 1 ? "s" : ""} from new evidence`, null, "/app/brain/proposals");
    } catch (e) {
      console.error("proposeUpdates failed", e);
    }
  }
  return { ok: true, added, warnings, proposals };
}

export async function deleteSource(db: DB, ws: Workspace, id: string) {
  const [src] = await db.select().from(schema.sources).where(and(eq(schema.sources.id, id), eq(schema.sources.workspaceId, ws.id)));
  if (!src) return false;
  await db.delete(schema.deals).where(eq(schema.deals.sourceId, id));
  await db.delete(schema.sources).where(eq(schema.sources.id, id));
  await logActivity(db, ws.id, "you", "source", `Deleted source: ${src.title}`, null, "/app/settings/data");
  return true;
}
