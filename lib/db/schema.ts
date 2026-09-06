import {
  bigint,
  bigserial,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
};

export const claims = pgTable("claims", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  claimantName: text("claimant_name").notNull(),
  lossType: text("loss_type").notNull(),
  reserveAmountCents: bigint("reserve_amount_cents", { mode: "number" }).notNull(),
  estimatedLossCents: bigint("estimated_loss_cents", { mode: "number" }),
  version: integer("version").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const claimInspections = pgTable("claim_inspections", {
  id: uuid("id").primaryKey().defaultRandom(),
  claimId: text("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  network: text("network").notNull(),
  status: text("status").notNull(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  ...timestamps
});

export const claimSettlements = pgTable("claim_settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  claimId: text("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  status: text("status").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  ...timestamps
});

export const claimNotes = pgTable("claim_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  claimId: text("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  ...timestamps
});

export const enterpriseIdempotencyLedger = pgTable("enterprise_idempotency_ledger", {
  key: text("key").primaryKey(),
  actionType: text("action_type").notNull(),
  claimId: text("claim_id").notNull().references(() => claims.id, { onDelete: "cascade" }),
  normalizedInputHash: text("normalized_input_hash").notNull(),
  resultJson: jsonb("result_json").notNull(),
  claimVersionAfter: integer("claim_version_after").notNull(),
  ...timestamps
});

export const faultProfiles = pgTable("fault_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  configJson: jsonb("config_json").notNull(),
  isSeeded: boolean("is_seeded").notNull().default(false)
});

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  scenarioId: text("scenario_id"),
  replayOfRunId: uuid("replay_of_run_id"),
  claimId: text("claim_id").notNull(),
  requestText: text("request_text").notNull(),
  plannerMode: text("planner_mode").notNull(),
  faultProfileId: text("fault_profile_id"),
  status: text("status").notNull(),
  actorId: text("actor_id").notNull(),
  demoSessionId: text("demo_session_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps
});

export const actionPlans = pgTable("action_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().unique().references(() => workflowRuns.id, { onDelete: "cascade" }),
  plannerProvider: text("planner_provider").notNull(),
  plannerModel: text("planner_model"),
  sourceClaimVersion: integer("source_claim_version").notNull(),
  rationaleSummary: text("rationale_summary").notNull(),
  rawProviderResponseJson: jsonb("raw_provider_response_json"),
  ...timestamps
});

export const plannedActions = pgTable(
  "planned_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id").notNull().references(() => actionPlans.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    actionType: text("action_type").notNull(),
    argumentsJson: jsonb("arguments_json").notNull(),
    riskLevel: text("risk_level").notNull(),
    expectedVersionAtPlan: integer("expected_version_at_plan").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull(),
    ...timestamps
  },
  (table) => [unique().on(table.planId, table.ordinal)]
);

export const actionAttempts = pgTable(
  "action_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plannedActionId: uuid("planned_action_id").notNull().references(() => plannedActions.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    expectedVersion: integer("expected_version").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    transportStatus: text("transport_status").notNull(),
    httpStatus: integer("http_status"),
    adapterOperationId: text("adapter_operation_id"),
    responseJson: jsonb("response_json"),
    errorCode: text("error_code"),
    errorMessage: text("error_message")
  },
  (table) => [unique().on(table.plannedActionId, table.attemptNumber)]
);

export const stateSnapshots = pgTable("state_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => workflowRuns.id, { onDelete: "cascade" }),
  plannedActionId: uuid("planned_action_id").references(() => plannedActions.id, { onDelete: "cascade" }),
  attemptId: uuid("attempt_id").references(() => actionAttempts.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  claimVersion: integer("claim_version"),
  stateJson: jsonb("state_json").notNull(),
  readStatus: text("read_status").notNull(),
  readErrorCode: text("read_error_code"),
  ...timestamps
});

export const reconciliations = pgTable("reconciliations", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").notNull().references(() => actionAttempts.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  desiredEffectJson: jsonb("desired_effect_json").notNull(),
  observedEffectJson: jsonb("observed_effect_json"),
  evidenceJson: jsonb("evidence_json").notNull(),
  reasonCode: text("reason_code").notNull(),
  reasonSummary: text("reason_summary").notNull(),
  ...timestamps
});

export const recoveryDecisionRows = pgTable("recovery_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => workflowRuns.id, { onDelete: "cascade" }),
  plannedActionId: uuid("planned_action_id").notNull().references(() => plannedActions.id, { onDelete: "cascade" }),
  attemptId: uuid("attempt_id").references(() => actionAttempts.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  reasonCode: text("reason_code").notNull(),
  reasonSummary: text("reason_summary").notNull(),
  ...timestamps
});

export const reviewRequests = pgTable("review_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => workflowRuns.id, { onDelete: "cascade" }),
  plannedActionId: uuid("planned_action_id").notNull().references(() => plannedActions.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  reasonCode: text("reason_code").notNull(),
  policySnapshotJson: jsonb("policy_snapshot_json").notNull(),
  claimSnapshotJson: jsonb("claim_snapshot_json").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedByActorId: text("decided_by_actor_id"),
  decisionNote: text("decision_note")
});

export const traceEvents = pgTable("trace_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  runId: uuid("run_id").notNull().references(() => workflowRuns.id, { onDelete: "cascade" }),
  plannedActionId: uuid("planned_action_id").references(() => plannedActions.id, { onDelete: "cascade" }),
  attemptId: uuid("attempt_id").references(() => actionAttempts.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull(),
  summary: text("summary").notNull(),
  detailsJson: jsonb("details_json").notNull(),
  ...timestamps
});

export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  suiteVersion: text("suite_version").notNull(),
  gitSha: text("git_sha"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  totalCases: integer("total_cases").notNull(),
  passedCases: integer("passed_cases").notNull().default(0),
  failedCases: integer("failed_cases").notNull().default(0)
});

export const evalCaseResults = pgTable("eval_case_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  evalRunId: uuid("eval_run_id").notNull().references(() => evalRuns.id, { onDelete: "cascade" }),
  caseId: text("case_id").notNull(),
  runId: uuid("run_id").references(() => workflowRuns.id, { onDelete: "set null" }),
  passed: boolean("passed").notNull(),
  assertionsJson: jsonb("assertions_json").notNull(),
  failureSummary: text("failure_summary"),
  durationMs: integer("duration_ms").notNull()
});
