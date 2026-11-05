"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema, DatabaseNotConfiguredError } from "@/server/db";
import { clearRateLimit, createSession, destroySession, hashPassword, normalizeEmail, rateLimit, verifyPassword } from "@/server/auth";

export type AuthState = { error?: string; fieldErrors?: Partial<Record<"name" | "email" | "password" | "company", string>>; values?: { name?: string; email?: string; company?: string } };

const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/app";
};

async function clientKey() {
  const h = await headers();
  return (h.get("x-forwarded-for") || h.get("x-real-ip") || "local").split(",")[0].trim();
}

function friendly(e: unknown): string {
  if (e instanceof DatabaseNotConfiguredError) return "The database isn’t connected yet. If you run this site, add a Postgres database in Vercel → Storage.";
  console.error(e);
  return "Something went wrong on our side. Please try again in a moment.";
}

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Use 80 characters or fewer."),
  company: z.string().trim().min(1, "Enter your company name.").max(80, "Use 80 characters or fewer."),
  email: z.string().trim().max(254).email("Enter a valid work email."),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Use 128 characters or fewer.")
    .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Include at least one letter and one number."),
});

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const values = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), company: String(form.get("company") ?? "") };
  const parsed = signUpSchema.safeParse({ ...values, password: String(form.get("password") ?? "") });
  if (!parsed.success) {
    const fe: AuthState["fieldErrors"] = {};
    for (const i of parsed.error.issues) fe[i.path[0] as keyof NonNullable<AuthState["fieldErrors"]>] ??= i.message;
    return { fieldErrors: fe, values };
  }
  try {
    const db = await getDb();
    if (!(await rateLimit(`signup:${await clientKey()}`, 10, 60))) return { error: "Too many sign-up attempts. Try again in an hour.", values };
    const email = normalizeEmail(parsed.data.email);
    const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (exists) return { fieldErrors: { email: "An account with this email already exists. Sign in instead." }, values };
    const [user] = await db
      .insert(schema.users)
      .values({ email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) })
      .onConflictDoNothing()
      .returning({ id: schema.users.id });
    if (!user) return { fieldErrors: { email: "An account with this email already exists. Sign in instead." }, values };
    await db.insert(schema.workspaces).values({ ownerId: user.id, name: parsed.data.company });
    await createSession(user.id);
  } catch (e) {
    return { error: friendly(e), values };
  }
  redirect("/onboarding");
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const emailRaw = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const values = { email: emailRaw };
  if (!emailRaw.trim() || !password) return { error: "Enter your email and password.", values };
  const email = normalizeEmail(emailRaw);
  try {
    const db = await getDb();
    const key = `signin:${email}`;
    if (!(await rateLimit(key, 8, 15))) return { error: "Too many attempts. Wait 15 minutes and try again.", values };
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    // Constant-ish time: always run bcrypt
    const ok = await verifyPassword(password, user?.passwordHash ?? "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    if (!user || !ok) return { error: "That email and password don’t match.", values };
    await clearRateLimit(key);
    await createSession(user.id);
  } catch (e) {
    return { error: friendly(e), values };
  }
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
