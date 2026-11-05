import "server-only";
import { z } from "zod";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
export type ProviderId = "groq" | "gemini";
export type GenSource = ProviderId | "offline";

type ProviderCfg = { id: ProviderId; url: string; key: string; model: string };

export function providers(): ProviderCfg[] {
  const out: ProviderCfg[] = [];
  if (process.env.GROQ_API_KEY)
    out.push({
      id: "groq",
      url: (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1") + "/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    });
  if (process.env.GEMINI_API_KEY)
    out.push({
      id: "gemini",
      url: (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai") + "/chat/completions",
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    });
  return out;
}

export function aiConfigured() {
  return providers().length > 0;
}

class ProviderError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}

async function callProvider(p: ProviderCfg, messages: ChatMsg[], opts: { json: boolean; maxTokens: number; temperature: number; timeoutMs: number }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const res = await fetch(p.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({
        model: p.model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(`${p.id} ${res.status}: ${body.slice(0, 200)}`, res.status === 429 || res.status >= 500 || res.status === 413 || res.status === 400);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new ProviderError(`${p.id}: empty response`, true);
    return text;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(`${p.id}: ${(e as Error).name === "AbortError" ? "timed out" : (e as Error).message}`, true);
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the first JSON object from model text (handles code fences and chatter). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("No JSON object found");
  }
}

export type GenOpts = {
  /** "large" prefers the long-context provider (Gemini) first. */
  size?: "fast" | "large";
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

function ordered(size: "fast" | "large") {
  const list = providers();
  return size === "large" ? [...list].sort((a) => (a.id === "gemini" ? -1 : 1)) : [...list].sort((a) => (a.id === "groq" ? -1 : 1));
}

export async function generateJson<T>(schema: z.ZodType<T>, messages: ChatMsg[], fallback: () => T, opts: GenOpts = {}): Promise<{ data: T; source: GenSource; error?: string }> {
  const errors: string[] = [];
  for (const p of ordered(opts.size ?? "fast")) {
    let convo = messages;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await callProvider(p, convo, {
          json: true,
          maxTokens: opts.maxTokens ?? 2000,
          temperature: opts.temperature ?? 0.4,
          timeoutMs: opts.timeoutMs ?? 40_000,
        });
        const parsed = schema.safeParse(extractJson(text));
        if (parsed.success) return { data: parsed.data, source: p.id };
        errors.push(`${p.id}: schema ${parsed.error.issues.slice(0, 3).map((i) => i.path.join(".") + " " + i.message).join("; ")}`);
        convo = [
          ...messages,
          { role: "assistant", content: text.slice(0, 6000) },
          { role: "user", content: `That JSON did not match the required shape (${errors.at(-1)}). Reply again with ONLY the corrected JSON object.` },
        ];
      } catch (e) {
        errors.push(String((e as Error).message));
        if (e instanceof ProviderError && !e.retryable) break;
        if (e instanceof ProviderError) break; // move to next provider on transport errors
      }
    }
  }
  return { data: fallback(), source: "offline", error: errors.join(" | ") || undefined };
}

export async function generateText(messages: ChatMsg[], fallback: () => string, opts: GenOpts = {}): Promise<{ text: string; source: GenSource }> {
  for (const p of ordered(opts.size ?? "fast")) {
    try {
      const text = await callProvider(p, messages, {
        json: false,
        maxTokens: opts.maxTokens ?? 1200,
        temperature: opts.temperature ?? 0.5,
        timeoutMs: opts.timeoutMs ?? 40_000,
      });
      return { text: text.trim(), source: p.id };
    } catch {
      /* try next */
    }
  }
  return { text: fallback(), source: "offline" };
}

/** Coercion helpers so small model quirks don't fail validation. */
export const zEvidence = z
  .string()
  .transform((s) => s.toLowerCase().trim())
  .pipe(z.enum(["supported", "weak", "assumed"]))
  .catch("assumed");

export const zStr = (max = 600) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim().slice(0, max));
