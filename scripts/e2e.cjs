// End-to-end QA run. node scripts/e2e.cjs http://localhost:3100 <shotsDir>
const { chromium } = require("playwright");
const path = require("path");
const BASE = process.argv[2] || "http://localhost:3100";
const SHOTS = process.argv[3] || "./shots";
const FIX = path.join(__dirname, "../tests/fixtures");
const errors = [];
let step = 0;
const log = (m) => console.log(`[${++step}] ${m}`);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|ERR_ABORTED|Failed to load resource/.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, n + ".png"), fullPage: true });
  const expectText = async (t, timeout = 15000) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout }); };

  await page.goto(BASE + "/"); await shot("01-home"); log("home");
  await page.goto(BASE + "/pricing"); await shot("02-pricing"); log("pricing");
  await page.goto(BASE + "/app"); await page.waitForURL(/sign-in\?next=/); log("protected redirect ok");

  await page.goto(BASE + "/sign-up");
  await page.getByRole("button", { name: "Create account" }).click();
  await expectText("Enter your name."); log("signup empty validation");
  await page.fill("#name", "Shah Zaman"); await page.fill("#company", "Acme Logistics"); await page.fill("#email", "shah@acme.test"); await page.fill("#password", "short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expectText("Use at least 8 characters."); log("weak password validation");
  await page.fill("#password", "orynrocks1");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/onboarding/); await shot("03-onboarding-1"); log("signed up -> onboarding");

  // Step 1 edge cases
  await page.fill("#website", "localhost:3000");
  await page.getByRole("button", { name: "Read my website" }).click();
  await expectText("Enter a public website address."); log("SSRF guard message");
  await page.getByLabel(/don’t have a website/).check();
  await page.fill("#description", "too short");
  await page.getByRole("button", { name: "Continue" }).click();
  await expectText("40+ characters"); log("short description validation");
  await page.fill("#description", "We sell route-optimisation software to mid-market logistics companies. Operations leaders buy it to cut empty miles and late deliveries.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expectText("A few questions only you can answer", 30000); await shot("04-onboarding-2"); log("step 2");

  await page.fill("#a0", "VP Operations at 3PLs");
  await page.getByRole("button", { name: "Continue" }).click();
  await expectText("Answer at least two questions"); log("answers validation");
  await page.fill("#a1", "Qualified demos — 4 a month today, want 12");
  await page.fill("#a2", "Mostly in-house BI dashboards");
  await page.getByRole("button", { name: "Continue" }).click();
  await expectText("Give Oryn your real evidence", 20000); log("step 3");

  await page.setInputFiles('input[type=file]', path.join(FIX, "bad.pdf"));
  await page.getByRole("button", { name: "Add evidence" }).click();
  await expectText("isn’t a valid PDF"); log("bad pdf rejected");
  await page.setInputFiles('input[type=file]', [path.join(FIX, "hubspot-deals.csv"), path.join(FIX, "call-notes.txt")]);
  await page.fill("#notes", "Pallet Co lost in September: the CFO joined late and pushed for a cheaper tool.");
  await page.getByRole("button", { name: "Add evidence" }).click();
  await expectText("Added 3 sources", 30000); await shot("05-onboarding-3"); log("evidence added");
  await page.getByRole("button", { name: "Build my Company Brain" }).click();
  await expectText("Here’s what Oryn believes", 60000); await shot("06-onboarding-4"); log("brain built");
  if (await page.getByText("Nonexistent source").count()) errors.push("hallucinated source shown");
  await page.getByRole("button", { name: "Correct it" }).first().click();
  await page.getByLabel("Corrected fact").fill("VP Operations at 3PLs and shippers with 50–500 employees signs.");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expectText("3PLs and shippers with 50–500"); log("fact corrected");
  await page.getByRole("button", { name: "This looks right" }).click();
  await expectText("What should this quarter move?", 20000); log("step 5");
  await page.fill("#title", "Reach 12 qualified demos a month");
  await page.fill("#metric", "Qualified demos per month");
  await page.fill("#baseline", "4"); await page.fill("#target", "12"); await page.fill("#unit", "demos");
  await page.getByRole("button", { name: "Create my first brief" }).click();
  await page.waitForURL(/\/app\?welcome=1/, { timeout: 90000 });
  await expectText("This week’s actions"); await page.waitForTimeout(600); await shot("07-week"); log("first week");

  // Mark done + undo
  await page.getByRole("button", { name: "Mark done" }).first().click();
  await page.fill("#outcome", "Sent to 6 deals, 2 replied.");
  await page.getByRole("dialog").getByRole("button", { name: "Mark done" }).click();
  await expectText("Marked done"); log("marked done");
  await page.getByRole("button", { name: "Undo" }).click();
  await expectText("Action reopened"); log("undo ok");
  // Skip validation (disabled until reason)
  await page.getByRole("button", { name: "Skip" }).first().click();
  const skipBtn = page.getByRole("dialog").getByRole("button", { name: "Skip action" });
  if (!(await skipBtn.isDisabled())) errors.push("skip enabled without reason");
  await page.getByRole("dialog").getByLabel("No time this week").check(); await skipBtn.click(); await expectText("Skipped"); log("skip ok");

  // Draft
  await page.getByRole("button", { name: /Draft the email|Draft the copy/ }).first().click();
  await page.waitForURL(/\/app\/drafts\//, { timeout: 30000 }); await expectText("claim"); await shot("08-draft"); log("draft created");
  await page.getByRole("button", { name: /^Use:/ }).first().click();
  await expectText("No flagged claims"); log("flag resolved");
  await page.getByRole("button", { name: "Copy", exact: true }).click(); await expectText("Copied"); log("copied");

  // Goals & bets
  await page.goto(BASE + "/app/goals"); await expectText("Active bets"); await shot("09-goals"); log("goals");
  await page.getByRole("button", { name: "Start bet" }).first().click(); await expectText("Bet started"); log("3rd bet started");
  await page.getByRole("button", { name: "Propose bets" }).click(); await expectText("bets proposed", 30000); log("proposed");
  await page.getByRole("button", { name: "Start bet" }).first().click(); await expectText("You already have 3 active bets"); log("limit dialog");
  await page.getByRole("dialog").getByRole("button", { name: "Pause & start" }).click(); await expectText("Bet started"); log("swapped");
  await page.locator('a[href^="/app/bets/"]').first().click(); await page.waitForURL(/\/app\/bets\//);
  await page.getByRole("button", { name: "End bet & record result" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close as won" }).click(); await expectText("Write a sentence"); log("end bet validation");
  await page.fill("#result", "Second-meeting rate went from 36% to 44% across 18 calls.");
  await page.getByRole("dialog").getByRole("button", { name: "Close as won" }).click();
  await page.waitForURL(/\/app\/learnings\//, { timeout: 30000 }); await expectText("What we now believe"); await shot("10-learning"); log("learning memo");

  // Brain + proposals from new evidence
  await page.goto(BASE + "/app/settings/data");
  await page.fill("#notes", "4 of our last 6 wins were 3PL providers rather than shippers. Deals above $30k always bring in the CFO.");
  await page.getByRole("button", { name: "Add evidence" }).click(); await expectText("Brain proposal", 30000); log("proposals from evidence");
  await page.goto(BASE + "/app/brain/proposals"); await shot("11-proposals");
  await page.getByRole("button", { name: "Accept", exact: true }).first().click(); await expectText("new Brain version saved"); log("proposal accepted");
  await page.goto(BASE + "/app/brain"); await shot("12-brain"); log("brain page");
  await page.goto(BASE + "/app/brain/versions"); await expectText("Current"); log("versions");

  // Ask
  await page.goto(BASE + "/app/ask"); await page.getByLabel("Your question").fill("Why is my top action first?"); await page.keyboard.press("Enter");
  await expectText("six demos", 30000); await shot("13-ask"); log("ask answered");

  // Pause
  await page.goto(BASE + "/app/settings/pause"); await page.getByRole("button", { name: "Pause Oryn" }).click(); await expectText("Oryn is paused"); log("paused");
  await page.goto(BASE + "/app"); await expectText("no new briefs"); await shot("14-paused"); log("pause banner");
  await page.goto(BASE + "/app/settings/pause"); await page.getByRole("button", { name: "Resume now" }).click(); await expectText("Oryn resumed"); log("resumed");

  // Export
  const r = await page.request.get(BASE + "/app/brain/export?format=md"); const md = await r.text();
  if (!md.includes("# Acme Logistics")) errors.push("export md missing title"); log("export " + r.status());

  // Activity, 404, sign-out / sign-in
  await page.goto(BASE + "/app/activity"); await shot("15-activity"); log("activity");
  await page.goto(BASE + "/app/actions/00000000-0000-0000-0000-000000000000"); await expectText("couldn’t find that page"); log("404 ok");
  await page.goto(BASE + "/app"); await page.getByRole("button", { name: "Sign out" }).click(); await page.waitForURL(BASE + "/"); log("signed out");
  await page.goto(BASE + "/sign-in");
  await page.fill("#email", "shah@acme.test"); await page.fill("#password", "wrongpass1"); await page.getByRole("button", { name: "Sign in" }).click();
  await expectText("don’t match"); log("wrong password");
  await page.fill("#password", "orynrocks1"); await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/app$/); log("signed in again");

  // Mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mp = await m.newPage(); await mp.goto(BASE + "/"); await mp.screenshot({ path: path.join(SHOTS, "16-mobile-home.png"), fullPage: true });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (overflow > 1) errors.push("mobile home horizontal overflow " + overflow);
  await mp.goto(BASE + "/sign-up"); await mp.screenshot({ path: path.join(SHOTS, "17-mobile-signup.png") }); log("mobile");
  // mobile app (share cookies)
  const cookies = await ctx.cookies(); await m.addCookies(cookies); await mp.goto(BASE + "/app"); await mp.screenshot({ path: path.join(SHOTS, "18-mobile-app.png"), fullPage: true });
  const ov2 = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (ov2 > 1) errors.push("mobile app overflow " + ov2);

  await browser.close();
  console.log("\nERRORS:", errors.length ? "\n" + errors.join("\n") : "none");
  process.exit(errors.length ? 1 : 0);
})().catch(async (e) => { console.error("FAILED at step", step + 1, e.message.split("\n").slice(0, 4).join(" | ")); console.log("ERRORS so far:", errors.join("\n")); process.exit(2); });
