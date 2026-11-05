import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { getDb, schema } from "./db";

export const SESSION_COOKIE = "oryn_session";
const SESSION_DAYS = 30;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 11);
}

export async function verifyPassword(pw: string, hash: string) {
  try {
    return await bcrypt.compare(pw, hash);
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const db = await getDb();
      await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
    } catch {
      /* best effort */
    }
  }
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20 || token.length > 100) return null;
  const db = await getDb();
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, createdAt: schema.users.createdAt })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
});

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/sign-in");
  return u;
}

/** Simple DB-backed rate limiter: max `limit` hits per key per `windowMin`. */
export async function rateLimit(key: string, limit: number, windowMin: number) {
  const db = await getDb();
  const since = new Date(Date.now() - windowMin * 60_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.loginAttempts)
    .where(and(eq(schema.loginAttempts.key, key), gt(schema.loginAttempts.createdAt, since)));
  if (Number(n) >= limit) return false;
  await db.insert(schema.loginAttempts).values({ key });
  return true;
}

export async function clearRateLimit(key: string) {
  const db = await getDb();
  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, key));
}
