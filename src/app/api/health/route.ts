import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { providers } from "@/server/ai/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = "ok";
  try {
    const d = await getDb();
    await d.execute(sql`select 1`);
  } catch (e) {
    console.error("health db", e);
    db = (e as Error).name === "DatabaseNotConfiguredError" ? "not_configured" : "error";
  }
  return NextResponse.json({ ok: db === "ok", db, ai: providers().map((p) => p.id) }, { status: db === "ok" ? 200 : 503 });
}
