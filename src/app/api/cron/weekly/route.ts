import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { createWeek, isPaused, weekStartFor } from "@/server/service";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function localParts(tz: string) {
  try {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hour12: false }).formatToParts(new Date());
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.find((x) => x.type === "weekday")?.value ?? "");
    return { day: wd, hour: Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24 };
  } catch {
    const d = new Date();
    return { day: d.getUTCDay(), hour: d.getUTCHours() };
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const all = await db.select().from(schema.workspaces).where(eq(schema.workspaces.stage, "active"));
  const results: { id: string; status: string }[] = [];
  const started = Date.now();
  for (const ws of all) {
    if (Date.now() - started > 240_000) break;
    if (isPaused(ws)) continue;
    const { day, hour } = localParts(ws.timezone);
    // Due if today is past the brief day/hour this week (daily cron catches up on the next run).
    const daysSinceMon = (day + 6) % 7;
    const briefIdx = (ws.briefDay + 6) % 7;
    if (daysSinceMon < briefIdx || (daysSinceMon === briefIdx && hour < ws.briefHour)) continue;
    const start = weekStartFor(new Date(), ws.timezone);
    const [existing] = await db.select({ id: schema.weeks.id }).from(schema.weeks).where(and(eq(schema.weeks.workspaceId, ws.id), eq(schema.weeks.weekStart, start))).limit(1);
    if (existing) continue;
    try {
      await createWeek(db, ws);
      results.push({ id: ws.id, status: "created" });
    } catch (e) {
      console.error("cron brief failed", ws.id, e);
      results.push({ id: ws.id, status: "error" });
    }
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}
