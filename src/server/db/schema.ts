import { pgTable, text, timestamp, integer, jsonb, boolean, real, uuid, date, index, uniqueIndex } from "drizzle-orm/pg-core";

export type SourceRef = { sourceId?: string | null; label: string; kind?: string; quote?: string | null };
export type Evidence = "supported" | "weak" | "assumed";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of token
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)],
);

export type Diagnosis = { bottleneck: string; summary: string; metric?: string | null; evidence: Evidence; evidenceCount?: string | null; refs?: SourceRef[] };
export type Rules = { neverPricing: boolean; flagUnsourced: boolean; askBeforeAssumed: boolean; custom: string[] };
export type Voice = { formality: number; directness: number; length: number; energy: number; use: string[]; avoid: string[]; samples: string };
export type Autonomy = Record<string, number>;
export type SiteRead = { title?: string; summary?: string; product?: string; audience?: string; positioning?: string; competitors?: string[]; pages?: { url: string; title: string }[] };
export type QA = { q: string; a: string };

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    website: text("website"),
    stage: text("stage").notNull().default("onboarding"), // onboarding | active
    onboardingStep: integer("onboarding_step").notNull().default(1),
    siteRead: jsonb("site_read").$type<SiteRead>(),
    questions: jsonb("questions").$type<string[]>(),
    answers: jsonb("answers").$type<QA[]>(),
    diagnosis: jsonb("diagnosis").$type<Diagnosis>(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedUntil: timestamp("paused_until", { withTimezone: true }),
    briefDay: integer("brief_day").notNull().default(1), // 0=Sun..6
    briefHour: integer("brief_hour").notNull().default(8),
    timezone: text("timezone").notNull().default("UTC"),
    autonomy: jsonb("autonomy").$type<Autonomy>(),
    rules: jsonb("rules").$type<Rules>(),
    voice: jsonb("voice").$type<Voice>(),
    brainVersion: integer("brain_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("workspaces_owner_idx").on(t.ownerId)],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // website | document | notes | crm | conversation
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sources_ws_idx").on(t.workspaceId)],
);

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    company: text("company"),
    stage: text("stage"),
    status: text("status").notNull().default("open"), // open | won | lost
    amount: real("amount"),
    createdOn: date("created_on"),
    closeDate: date("close_date"),
    lostReason: text("lost_reason"),
    notes: text("notes"),
  },
  (t) => [index("deals_ws_idx").on(t.workspaceId)],
);

export const facts = pgTable(
  "facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    text: text("text").notNull(),
    evidence: text("evidence").$type<Evidence>().notNull().default("assumed"),
    evidenceCount: text("evidence_count"),
    refs: jsonb("refs").$type<SourceRef[]>().notNull().default([]),
    confirmed: boolean("confirmed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("facts_ws_idx").on(t.workspaceId)],
);

export const brainVersions = pgTable(
  "brain_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    summary: text("summary").notNull(),
    author: text("author").notNull(), // you | oryn
    snapshot: jsonb("snapshot").$type<{ category: string; text: string; evidence: string }[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("brain_versions_ws_idx").on(t.workspaceId)],
);

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // add | update
    factId: uuid("fact_id"),
    category: text("category").notNull(),
    currentText: text("current_text"),
    proposedText: text("proposed_text").notNull(),
    rationale: text("rationale").notNull(),
    evidence: text("evidence").$type<Evidence>().notNull().default("weak"),
    evidenceCount: text("evidence_count"),
    refs: jsonb("refs").$type<SourceRef[]>().notNull().default([]),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("proposals_ws_idx").on(t.workspaceId)],
);

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  metric: text("metric").notNull(),
  baseline: real("baseline"),
  target: real("target"),
  current: real("current"),
  unit: text("unit"),
  dueDate: date("due_date"),
  status: text("status").notNull().default("active"), // active | achieved | archived
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bets = pgTable(
  "bets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    hypothesis: text("hypothesis").notNull(),
    metric: text("metric").notNull(),
    effort: text("effort"),
    evidence: text("evidence").$type<Evidence>().notNull().default("weak"),
    evidenceCount: text("evidence_count"),
    refs: jsonb("refs").$type<SourceRef[]>().notNull().default([]),
    status: text("status").notNull().default("proposed"), // proposed | active | paused | won | killed | dismissed
    durationDays: integer("duration_days").notNull().default(21),
    killCriteria: text("kill_criteria"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    resultNote: text("result_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bets_ws_idx").on(t.workspaceId)],
);

export const weeks = pgTable(
  "weeks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    headline: text("headline"),
    generatedBy: text("generated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("weeks_ws_idx").on(t.workspaceId)],
);

export type ReasoningStep = { step: string; ref?: string };
export type ActionFeedback = { reason?: string; note?: string; at?: string };

export const actions = pgTable(
  "actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    weekId: uuid("week_id").notNull().references(() => weeks.id, { onDelete: "cascade" }),
    betId: uuid("bet_id").references(() => bets.id, { onDelete: "set null" }),
    rank: integer("rank").notNull(),
    title: text("title").notNull(),
    why: text("why").notNull(),
    effort: text("effort"),
    impact: text("impact").notNull().default("medium"),
    autonomy: integer("autonomy").notNull().default(1),
    draftKind: text("draft_kind"), // email | post | copy | none
    evidence: text("evidence").$type<Evidence>().notNull().default("assumed"),
    evidenceCount: text("evidence_count"),
    refs: jsonb("refs").$type<SourceRef[]>().notNull().default([]),
    reasoning: jsonb("reasoning").$type<ReasoningStep[]>().notNull().default([]),
    successMetric: text("success_metric"),
    status: text("status").notNull().default("open"), // open | done | skipped | disagreed
    feedback: jsonb("feedback").$type<ActionFeedback>(),
    outcome: text("outcome"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("actions_ws_idx").on(t.workspaceId), index("actions_week_idx").on(t.weekId)],
);

export type DraftFlag = { text: string; issue: string; suggestion?: string };
export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    actionId: uuid("action_id").references(() => actions.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // email | post | copy
    title: text("title").notNull(),
    recipient: text("recipient"),
    subject: text("subject"),
    body: text("body").notNull(),
    flags: jsonb("flags").$type<DraftFlag[]>().notNull().default([]),
    status: text("status").notNull().default("draft"), // draft | copied | archived
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("drafts_ws_idx").on(t.workspaceId)],
);

export const learnings = pgTable(
  "learnings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    betId: uuid("bet_id").references(() => bets.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    tried: text("tried").notNull(),
    happened: text("happened").notNull(),
    believe: text("believe").notNull(),
    changes: text("changes").notNull(),
    evidence: text("evidence").$type<Evidence>().notNull().default("weak"),
    evidenceCount: text("evidence_count"),
    reaction: text("reaction"), // agree | disagree
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("learnings_ws_idx").on(t.workspaceId)],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(), // you | oryn
    type: text("type").notNull(),
    message: text("message").notNull(),
    detail: text("detail"),
    href: text("href"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activities_ws_idx").on(t.workspaceId, t.createdAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    refs: jsonb("refs").$type<SourceRef[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_ws_idx").on(t.workspaceId, t.createdAt)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id"),
    task: text("task").notNull(),
    provider: text("provider").notNull(),
    ok: boolean("ok").notNull(),
    ms: integer("ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_ws_idx").on(t.workspaceId, t.createdAt)],
);
