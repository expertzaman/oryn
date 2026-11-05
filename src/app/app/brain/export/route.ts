import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { getWorkspace } from "@/server/service";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = await getDb();
  const ws = await getWorkspace(db, user.id);
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 404 });
  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "md";
  const [facts, goals, bets, learnings, versions] = await Promise.all([
    db.select().from(schema.facts).where(eq(schema.facts.workspaceId, ws.id)).orderBy(schema.facts.category),
    db.select().from(schema.goals).where(eq(schema.goals.workspaceId, ws.id)),
    db.select().from(schema.bets).where(eq(schema.bets.workspaceId, ws.id)),
    db.select().from(schema.learnings).where(eq(schema.learnings.workspaceId, ws.id)).orderBy(desc(schema.learnings.createdAt)),
    db.select({ version: schema.brainVersions.version, summary: schema.brainVersions.summary, author: schema.brainVersions.author, createdAt: schema.brainVersions.createdAt }).from(schema.brainVersions).where(eq(schema.brainVersions.workspaceId, ws.id)).orderBy(desc(schema.brainVersions.version)),
  ]);
  const slug = ws.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
  const date = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), company: ws.name, website: ws.website, brainVersion: ws.brainVersion, diagnosis: ws.diagnosis, facts: facts.map((f) => ({ id: f.id, category: f.category, text: f.text, evidence: f.evidence, evidenceCount: f.evidenceCount, refs: f.refs, confirmed: f.confirmed, updatedAt: f.updatedAt })), goals, bets, learnings, versions }, null, 2);
    return new NextResponse(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="oryn-${slug}-${date}.json"`, "Cache-Control": "no-store" } });
  }
  const cats = [...new Set(facts.map((f) => f.category))];
  const md = [
    `# ${ws.name} — Company Brain v${ws.brainVersion}`,
    `Exported ${date}${ws.website ? ` · ${ws.website}` : ""}`,
    ws.diagnosis ? `\n## Diagnosis\n**${ws.diagnosis.bottleneck}** — ${ws.diagnosis.summary} _(${ws.diagnosis.evidence})_` : "",
    ...cats.map((c) => `\n## ${c}\n${facts.filter((f) => f.category === c).map((f) => `- ${f.text} _(${f.evidence}${f.evidenceCount ? `, ${f.evidenceCount}` : ""})_${f.refs.length ? ` — sources: ${f.refs.map((r) => r.label).join("; ")}` : ""}`).join("\n")}`),
    goals.length ? `\n## Goals\n${goals.map((g) => `- ${g.title} (${g.status}) — ${g.metric}${g.target != null ? `: ${g.current ?? "?"} → ${g.target}` : ""}`).join("\n")}` : "",
    bets.length ? `\n## Bets\n${bets.filter((b) => b.status !== "dismissed").map((b) => `- **${b.title}** (${b.status}) — ${b.hypothesis}${b.resultNote ? ` Result: ${b.resultNote}` : ""}`).join("\n")}` : "",
    learnings.length ? `\n## Learnings\n${learnings.map((l) => `### ${l.title}\n- Tried: ${l.tried}\n- Happened: ${l.happened}\n- Now believe: ${l.believe}\n- Changes: ${l.changes}`).join("\n\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return new NextResponse(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="oryn-${slug}-${date}.md"`, "Cache-Control": "no-store" } });
}
