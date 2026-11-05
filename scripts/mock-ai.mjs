// Local OpenAI-compatible mock for QA. Returns shaped JSON per Oryn task. Usage: node scripts/mock-ai.mjs 8787 [fail-rate]
import http from "node:http";
const port = Number(process.argv[2] || 8787);
const failRate = Number(process.argv[3] || 0);
const labels = (t) => [...t.matchAll(/^### (.+?) \[(\w+)\]$/gm)].map((m) => m[1]);
function answer(prompt) {
  const L = labels(prompt);
  const ref = (i) => (L[i] ? [{ label: L[i], quote: "quoted evidence line" }] : []);
  if (prompt.includes("public website and summarise"))
    return { summary: "Acme Logistics sells route-optimisation software to mid-market logistics companies.", product: "Route optimisation SaaS", audience: "Operations leaders at 3PLs", positioning: "Cut empty miles", competitors: ["FourKites"], questions: ["Who signs the contract?", "What number do you want to move this quarter?", "Who do you lose to?", "Why do customers buy?", "Best channel?"] };
  if (prompt.includes("Company Brain\": 8-14"))
    return { facts: [
      { category: "ICP", text: "VP Operations at 3PLs with 50–500 employees signs the contract.", evidence: "supported", evidenceCount: "12 deals", refs: ref(1) },
      { category: "Objections", text: "Most lost deals cite price or budget.", evidence: "weak", evidenceCount: "3 deals", refs: ref(1) },
      { category: "Positioning", text: "The homepage promise targets finance buyers, not ops.", evidence: "weak", evidenceCount: "website", refs: [{ label: "Nonexistent source", quote: null }] },
      { category: "competitors", text: "Main alternative is in-house BI dashboards.", evidence: "ASSUMED", refs: [] },
    ], diagnosis: { bottleneck: "Demos stall after the first call", summary: "Only a third of first calls get a second meeting.", metric: "Second-meeting rate", evidence: "weak", evidenceCount: "8 deals", refs: ref(0) } };
  if (prompt.includes("Propose 3 time-boxed growth bets"))
    return { bets: [
      { title: "ROI calculator for ops leads", hypothesis: "If ops leads can size savings before call 2, second-meeting rate rises.", metric: "Second-meeting rate", effort: "~2 days", evidence: "weak", evidenceCount: "5 calls", killCriteria: "No lift by day 14", durationDays: 21, refs: ref(0) },
      { title: "Second-touch follow-ups", hypothesis: "If silent demos get a second touch in 10 days, 3 of 8 move to trial.", metric: "Demo → trial", effort: "~2 h/week", evidence: "weak", evidenceCount: "6 deals", killCriteria: "", durationDays: "21", refs: [] },
      { title: "Ops-first homepage", hypothesis: "If the headline names ops teams, demo requests rise.", metric: "Homepage → demo", effort: "~1 day", evidence: "assumed", refs: [] },
    ] };
  if (prompt.includes("this week's brief"))
    return { headline: "Fix the second-call drop-off", actions: [
      { title: "Send second touches to 6 silent demos", why: "Six demos went quiet after call one.", bet: "Second-touch follow-ups", effort: "~45 min", impact: "High", autonomy: 2, draftKind: "email", evidence: "weak", evidenceCount: "6 deals", refs: ref(1), reasoning: ["Counted silent demos", "Second touches revived deals before"], successMetric: "Replies within 5 days" },
      { title: "Rewrite the homepage headline for ops leaders", why: "The headline speaks to CFOs.", bet: "Ops-first homepage", effort: "~45 min", impact: "medium", autonomy: 2, draftKind: "copy", evidence: "weak", refs: ref(0), reasoning: ["Read the homepage"], successMetric: null },
      { title: "Call two recent customers", why: "Validate the ICP.", bet: null, effort: "~1 h", impact: "low", autonomy: 1, draftKind: "none", evidence: "assumed", refs: [], reasoning: [] },
    ] };
  if (prompt.includes("in the founder's voice, ready to paste"))
    return { kind: "email", title: "Second touch", recipient: "[First name], Northbeam Freight", subject: "Quick follow-up", body: "Hi [First name],\n\nWe cut onboarding time by 60% for Carrow 3PL.\n\nWorth a 20-minute call?\n\nShah", flags: [{ text: "cut onboarding time by 60%", issue: "Not in your evidence.", suggestion: "went live in 12 days" }, { text: "not in body", issue: "x" }] };
  if (prompt.includes("Write a learning memo"))
    return { title: "Second touches revive ops-led demos", tried: "Second touches to silent demos.", happened: "4 of 6 replied.", believe: "Silence, not rejection, stalls ops deals.", changes: "Oryn auto-suggests second touches at day 10.", evidence: "weak", evidenceCount: "6 deals" };
  if (prompt.includes("New evidence was added"))
    return { proposals: [{ factIndex: 0, category: "ICP", proposedText: "VP Operations at shippers and 3PLs with 50–500 employees.", rationale: "4 of the last 6 wins were 3PLs.", evidence: "weak", evidenceCount: "4 deals", refs: [] }, { factIndex: null, category: "Pricing", proposedText: "Deals over $30k pull in the CFO.", rationale: "Seen in notes.", evidence: "assumed", refs: [] }] };
  return { answer: "Because **six demos** went silent after the first call.\n\n- Second touches worked before\n- It takes under an hour", refs: [{ label: L[0] || "x", quote: "q" }], followUps: ["Which demos?", "Draft it"] };
}
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (Math.random() < failRate) { res.writeHead(429); return res.end("rate limited"); }
    try {
      const j = JSON.parse(body);
      const prompt = j.messages.map((m) => m.content).join("\n");
      const out = answer(prompt);
      // Wrap in a code fence half the time to exercise the extractor
      const text = Math.random() < 0.5 ? "```json\n" + JSON.stringify(out) + "\n```" : JSON.stringify(out);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: text } }] }));
    } catch (e) { res.writeHead(400); res.end(String(e)); }
  });
}).listen(port, () => console.log("mock ai on", port));
