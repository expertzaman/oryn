# Oryn

Growth intelligence for B2B SaaS founders: Oryn reads your website, CRM exports and sales notes, builds a graded **Company Brain**, and writes a weekly brief of three ranked actions — each with its evidence.

Includes the marketing website (`/`, `/pricing`, `/security`, `/privacy`, `/terms`), email/password auth, onboarding, and the full app: This Week, action detail, drafts with claim flags and voice profile, goals & bets (max 3 active), Company Brain with proposals and version history, learnings, activity, Ask Oryn, settings, global pause and data export.

## Stack
Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS v4 · Drizzle ORM · Postgres (Neon) · Groq (Llama 3.3 70B) + Google Gemini with automatic fallback · Geist Sans.

## Deploy on Vercel
1. Import this repo in Vercel.
2. **Storage → Create → Neon (Postgres)** and connect it to the project. `DATABASE_URL` is added for you. Tables are created automatically on first request.
3. **Settings → Environment Variables**: add `GROQ_API_KEY` and/or `GEMINI_API_KEY`, `CRON_SECRET`, and `NEXT_PUBLIC_SITE_URL`.
4. Redeploy. Check `https://<your-domain>/api/health` → `{"ok":true,"db":"ok","ai":["groq","gemini"]}`.

Without AI keys the app still works end to end using Oryn's built-in rules, and shows a notice.

## Local development
```bash
npm install
npm run dev        # uses an embedded Postgres in ./.data when DATABASE_URL is empty
```

## Quality checks
```bash
npm run typecheck && npm run lint && npm test
node scripts/mock-ai.mjs 8787 &                       # fake OpenAI-compatible AI for QA
GROQ_API_KEY=test GROQ_BASE_URL=http://127.0.0.1:8787 DATABASE_URL=pglite:./.data/e2e npm run build && npx next start -p 3100 &
node scripts/e2e.cjs http://localhost:3100 ./shots    # full journey in Playwright
```

## Weekly brief schedule
`vercel.json` runs `/api/cron/weekly` daily at 06:00 UTC. Each workspace gets a new brief once its chosen day and hour have passed in its time zone.
