import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class WebsiteError extends Error {}

const MAX_BYTES = 1_500_000;
const PAGE_TIMEOUT = 8000;

export function normalizeUrl(input: string): URL {
  let s = (input || "").trim();
  if (!s) throw new WebsiteError("Enter your website address.");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new WebsiteError("That doesn’t look like a web address. Try something like acme.com.");
  }
  if (!["http:", "https:"].includes(u.protocol)) throw new WebsiteError("Only http and https websites can be read.");
  if (u.username || u.password) throw new WebsiteError("Remove the username and password from the address.");
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") throw new WebsiteError("Enter a public website address.");
  u.hash = "";
  return u;
}

function isPrivateIp(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
}

async function assertPublic(u: URL) {
  if (isIP(u.hostname)) {
    if (isPrivateIp(u.hostname)) throw new WebsiteError("Enter a public website address.");
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(u.hostname, { all: true });
  } catch {
    throw new WebsiteError(`We couldn’t find ${u.hostname}. Check the spelling.`);
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new WebsiteError("Enter a public website address.");
}

async function fetchPage(url: URL, redirects = 0): Promise<{ url: URL; html: string }> {
  await assertPublic(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": "OrynBot/1.0 (+company research for the site owner)", Accept: "text/html,application/xhtml+xml" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc || redirects >= 4) throw new WebsiteError("The website redirected too many times.");
      return fetchPage(new URL(loc, url), redirects + 1);
    }
    if (!res.ok) throw new WebsiteError(`The website answered with an error (${res.status}).`);
    const type = res.headers.get("content-type") || "";
    if (!/html|xml|text\/plain/i.test(type)) throw new WebsiteError("That address isn’t a web page.");
    const reader = res.body?.getReader();
    if (!reader) return { url, html: await res.text() };
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    return { url, html: new TextDecoder().decode(Buffer.concat(chunks)) };
  } catch (e) {
    if (e instanceof WebsiteError) throw e;
    if ((e as Error).name === "AbortError") throw new WebsiteError("The website took too long to respond.");
    throw new WebsiteError("We couldn’t reach that website. Check the address or try again.");
  } finally {
    clearTimeout(t);
  }
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export function htmlToText(html: string) {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim()).replace(/\s+/g, " ");
  const description = decode(html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? "");
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|section|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decode(body)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 2)
    .filter((l, i, arr) => arr.indexOf(l) === i)
    .join("\n");
  return { title, description, text };
}

function pickLinks(html: string, base: URL) {
  const out = new Map<string, URL>();
  const re = /<a[^>]+href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1], base);
      if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
      if (!/(pricing|about|product|customers|case|solution|features|platform|why)/i.test(u.pathname)) continue;
      if (/\.(pdf|png|jpg|zip)$/i.test(u.pathname)) continue;
      u.search = "";
      u.hash = "";
      out.set(u.pathname, u);
    } catch {
      /* ignore bad hrefs */
    }
  }
  return [...out.values()].slice(0, 4);
}

export type SitePage = { url: string; title: string; text: string };

export async function readWebsite(input: string): Promise<{ origin: string; pages: SitePage[]; description: string }> {
  const url = normalizeUrl(input);
  const home = await fetchPage(url);
  const parsed = htmlToText(home.html);
  if (parsed.text.length < 80 && !parsed.description) throw new WebsiteError("We could read the page but found almost no text. If your site renders with JavaScript only, paste a description in the next step instead.");
  const pages: SitePage[] = [{ url: home.url.toString(), title: parsed.title || home.url.hostname, text: parsed.text.slice(0, 9000) }];
  const links = pickLinks(home.html, home.url);
  const extra = await Promise.allSettled(links.map((l) => fetchPage(l)));
  for (const r of extra) {
    if (r.status !== "fulfilled") continue;
    const p = htmlToText(r.value.html);
    if (p.text.length > 120) pages.push({ url: r.value.url.toString(), title: p.title || r.value.url.pathname, text: p.text.slice(0, 5000) });
  }
  return { origin: home.url.origin, pages, description: parsed.description };
}
