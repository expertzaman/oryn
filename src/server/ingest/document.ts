import "server-only";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED = [".pdf", ".txt", ".md", ".csv"];

export class DocumentError extends Error {}

export async function extractText(file: File): Promise<{ kind: "pdf" | "text" | "csv"; text: string }> {
  if (!file || typeof file.arrayBuffer !== "function") throw new DocumentError("No file received.");
  if (file.size === 0) throw new DocumentError(`${file.name} is empty.`);
  if (file.size > MAX_UPLOAD_BYTES) throw new DocumentError(`${file.name} is larger than 5 MB.`);
  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf("."));
  if (!ACCEPTED.includes(ext)) throw new DocumentError(`${file.name}: only PDF, TXT, MD and CSV files are supported.`);
  const buf = new Uint8Array(await file.arrayBuffer());
  if (ext === ".pdf") {
    if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) throw new DocumentError(`${file.name} isn’t a valid PDF.`);
    try {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(buf);
      const { text } = await pdfText(pdf, { mergePages: true });
      const out = (Array.isArray(text) ? text.join("\n") : text).replace(/[ \t]+/g, " ").trim();
      if (out.length < 40) throw new DocumentError(`${file.name} has no readable text (it may be a scanned image).`);
      return { kind: "pdf", text: out.slice(0, 120_000) };
    } catch (e) {
      if (e instanceof DocumentError) throw e;
      throw new DocumentError(`${file.name} couldn’t be read. If it’s password-protected, remove the password and try again.`);
    }
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (/\u0000/.test(text.slice(0, 2000))) throw new DocumentError(`${file.name} doesn’t look like a text file.`);
  if (text.trim().length < 10) throw new DocumentError(`${file.name} has almost no text.`);
  return { kind: ext === ".csv" ? "csv" : "text", text: text.slice(0, 2_000_000) };
}
