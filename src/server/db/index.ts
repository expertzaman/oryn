import "server-only";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { MIGRATIONS } from "./migrations";

export type DB = ReturnType<typeof neonDrizzle<typeof schema>>;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set. Add a Postgres database (for example Neon from the Vercel Marketplace).");
    this.name = "DatabaseNotConfiguredError";
  }
}

const g = globalThis as unknown as { __orynDb?: Promise<DB>; __orynMigrated?: Promise<void> };

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || "";
}

async function create(): Promise<DB> {
  const url = connectionString();
  if (!url || url.startsWith("pglite")) {
    if (process.env.VERCEL) throw new DatabaseNotConfiguredError();
    // Local development / tests: embedded Postgres (PGlite), persisted to .data/
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const dir = url.startsWith("pglite:") ? url.slice(7) : "./.data/pglite";
    if (dir !== "memory") (await import("node:fs")).mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir === "memory" ? undefined : dir);
    return drizzle(client, { schema }) as unknown as DB;
  }
  return neonDrizzle(neon(url), { schema });
}

async function migrate(db: DB) {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS "_oryn_migrations" ("name" text PRIMARY KEY, "applied_at" timestamptz NOT NULL DEFAULT now())`);
  const rows = (await db.execute(sql`SELECT name FROM "_oryn_migrations"`)) as unknown as { rows?: { name: string }[] } | { name: string }[];
  const list = Array.isArray(rows) ? rows : rows.rows ?? [];
  const done = new Set(list.map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    for (const stmt of m.statements) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        // Tolerate concurrent cold starts racing on the same migration.
        if (!/already exists/i.test(msg)) throw e;
      }
    }
    await db.execute(sql`INSERT INTO "_oryn_migrations" (name) VALUES (${m.name}) ON CONFLICT DO NOTHING`);
  }
}

export async function getDb(): Promise<DB> {
  if (!g.__orynDb) {
    g.__orynDb = create().catch((e) => {
      g.__orynDb = undefined;
      throw e;
    });
  }
  const db = await g.__orynDb;
  if (!g.__orynMigrated) {
    g.__orynMigrated = migrate(db).catch((e) => {
      g.__orynMigrated = undefined;
      throw e;
    });
  }
  await g.__orynMigrated;
  return db;
}

export { schema };
