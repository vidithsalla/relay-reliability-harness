import { randomUUID } from "node:crypto";

import { ClaimsEnterpriseAdapter } from "@/lib/adapters/claims-adapter";
import type { MutationContext } from "@/lib/adapters/enterprise-adapter";
import { pool } from "@/lib/db/client";
import { deriveIdempotencyKey } from "@/lib/domain/canonical-json";
import { desiredEffectForAction } from "@/lib/domain/desired-effects";
import {
  EnterpriseMalformedResponseError,
  EnterpriseTimeoutError,
  EnterpriseTransientError,
  EnterpriseVersionConflictError,
  normalizeError
} from "@/lib/domain/errors";
import type {
  ActionArguments,
  ActionDraft,
  ActionType,
  AdapterMutationResult,
  ClaimAggregate,
  FaultProfileConfig,
  PlannedActionRecord,
  PlannerMode,
  RunStatus,
  TransportStatus
} from "@/lib/domain/types";
import { FaultProfileConfigSchema } from "@/lib/domain/types";
import { getSeededFaultProfile } from "@/lib/fixtures/fault-profiles";
import { FaultInjectingAdapter, FaultRecorder } from "@/lib/faults/fault-injecting-adapter";
import { getPlannerProvider } from "@/lib/ai/planner";
import { evaluateActionPolicy, AUTONOMOUS_SETTLEMENT_LIMIT_CENTS, canActorReview } from "@/lib/policies/risk-policy";
import { reconcile } from "@/lib/reconciliation/reconciliation-engine";
import { decideRecovery } from "@/lib/recovery/recovery-engine";

const MAX_ATTEMPTS = 2;

type CreateRunInput = {
  claimId: string;
  requestText: string;
  plannerMode?: PlannerMode;
  faultProfileId?: string | null;
  scenarioId?: string | null;
  actorId?: string;
  replayOfRunId?: string | null;
  logicalRunNamespace?: string;
  autoApproveHighRisk?: boolean;
};

type DbActionRow = {
  id: string;
  plan_id: string;
  ordinal: number;
  action_type: ActionType;
  arguments_json: ActionArguments;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  expected_version_at_plan: number;
  idempotency_key: string;
  status: PlannedActionRecord["status"];
};

export async function createAndStartRun(input: CreateRunInput): Promise<{ runId: string; status: RunStatus }> {
  const adapter = new ClaimsEnterpriseAdapter();
  const claim = await adapter.getClaim(input.claimId);
  const runId = randomUUID();
  const plannerMode = input.plannerMode ?? "deterministic";
  const faultProfile = await loadFaultProfile(input.faultProfileId);

  await pool.query(
    `
      INSERT INTO workflow_runs (
        id, scenario_id, replay_of_run_id, claim_id, request_text, planner_mode, fault_profile_id, status, actor_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'PLANNING', $8)
    `,
    [
      runId,
      input.scenarioId ?? null,
      input.replayOfRunId ?? null,
      input.claimId,
      input.requestText,
      plannerMode,
      faultProfile.id,
      input.actorId ?? "operator"
    ]
  );
  await trace(runId, null, null, "RUN_CREATED", "INFO", "Run created.", {
    claimId: input.claimId,
    faultProfileId: faultProfile.id
  });
  await snapshot(runId, null, null, "PRE_PLAN", claim);

  const planner = getPlannerProvider(plannerMode);
  const plan = await planner.createPlan({
    requestText: input.requestText,
    claim,
    allowedActions: ["SET_RESERVE", "SCHEDULE_INSPECTION", "ISSUE_SETTLEMENT", "ADD_CLAIM_NOTE"],
    policyContext: { autonomousSettlementLimitCents: AUTONOMOUS_SETTLEMENT_LIMIT_CENTS }
  });
  if (plan.kind === "UNSUPPORTED" || plan.claimId !== input.claimId) {
    await updateRunStatus(runId, "PLAN_INVALID", true);
    await trace(runId, null, null, "PLAN_REJECTED", "ERROR", "Plan failed closed.", plan);
    return { runId, status: "PLAN_INVALID" };
  }

  const planId = randomUUID();
  await pool.query(
    `
      INSERT INTO action_plans (
        id, run_id, planner_provider, planner_model, source_claim_version, rationale_summary, raw_provider_response_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      planId,
      runId,
      planner.provider,
      planner.model,
      claim.version,
      plan.rationaleSummary,
      JSON.stringify(plan)
    ]
  );
  await trace(runId, null, null, "PLAN_CREATED", "INFO", "Typed plan created and schema validated.", {
    actionCount: plan.actions.length,
    sourceClaimVersion: claim.version
  });

  let hasReview = false;
  let hasBlock = false;
  for (const [index, draft] of plan.actions.entries()) {
    const actionType = draft.type;
    const args = draftToArguments(draft);
    const policy = evaluateActionPolicy({ actionType, argumentsJson: args, claim });
    const actionId = randomUUID();
    const idempotencyKey = deriveIdempotencyKey({
      canonicalVersion: "relay-v1",
      logicalRunNamespace: input.logicalRunNamespace ?? runId,
      actionOrdinal: index + 1,
      actionType,
      argumentsJson: args
    });
    const status = !policy.ok
      ? "BLOCKED_PRECONDITION"
      : policy.requiresReview && !input.autoApproveHighRisk
        ? "WAITING_REVIEW"
        : "READY";
    await pool.query(
      `
        INSERT INTO planned_actions (
          id, plan_id, ordinal, action_type, arguments_json, risk_level, expected_version_at_plan, idempotency_key, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        actionId,
        planId,
        index + 1,
        actionType,
        JSON.stringify(args),
        policy.riskLevel,
        claim.version,
        idempotencyKey,
        status
      ]
    );
    if (!policy.ok) {
      hasBlock = true;
      await trace(runId, actionId, null, "ACTION_BLOCKED", "WARN", policy.reasonSummary, {
        reasonCode: policy.reasonCode
      });
      await recordRecovery(runId, actionId, null, "FAIL_CLOSED", policy.reasonCode, policy.reasonSummary);
    } else if (policy.requiresReview && !input.autoApproveHighRisk) {
      hasReview = true;
      await createReview(runId, actionId, policy.reasonCode, policy.reasonSummary, claim);
    } else {
      await trace(runId, actionId, null, "ACTION_READY", "INFO", "Action ready for execution.", {
        actionType,
        expectedVersion: claim.version
      });
    }
  }

  if (hasBlock) {
    await updateRunStatus(runId, "FAILED_CLOSED", true);
    return { runId, status: "FAILED_CLOSED" };
  }
  if (hasReview) {
    await updateRunStatus(runId, "WAITING_REVIEW", false);
    return { runId, status: "WAITING_REVIEW" };
  }
  await updateRunStatus(runId, "EXECUTING", false);
  return executeRun(runId, faultProfile.config);
}

export async function executeRun(runId: string, profileConfig?: FaultProfileConfig): Promise<{ runId: string; status: RunStatus }> {
  const run = await getRunRow(runId);
  const adapter = new ClaimsEnterpriseAdapter();
  const profile = profileConfig ?? (await loadFaultProfile(run.fault_profile_id)).config;
  const actions = await getActionsForRun(runId);
  let expectedVersion = actions[0]?.expectedVersionAtPlan ?? 0;

  for (const action of actions) {
    if (action.status === "COMPLETED") {
      const current = await adapter.getClaim(run.claim_id);
      expectedVersion = current.version;
      continue;
    }
    if (action.status !== "READY" && action.status !== "RETRY_SCHEDULED") {
      continue;
    }
    let continueSameAction = true;
    while (continueSameAction) {
      continueSameAction = false;
      const attemptNumber = (await countAttempts(action.id)) + 1;
      const preState = await adapter.getClaim(run.claim_id);
      if (preState.version !== expectedVersion) {
        await markActionAndRunReplan(runId, action.id, expectedVersion, preState.version);
        return { runId, status: "REPLAN_REQUIRED" };
      }
      await snapshot(runId, action.id, null, "PRE_ACTION", preState);
      const attemptId = randomUUID();
      await insertAttempt(attemptId, action, attemptNumber, expectedVersion, "SUCCESS_RESPONSE");
      await trace(runId, action.id, attemptId, "ATTEMPT_STARTED", "INFO", `Attempt ${attemptNumber} started.`, {
        expectedVersion,
        idempotencyKey: action.idempotencyKey
      });
      await pool.query("UPDATE planned_actions SET status = 'EXECUTING' WHERE id = $1", [action.id]);

      const recorder = new FaultRecorder();
      const faulted = new FaultInjectingAdapter(
        adapter,
        profile,
        { actionOrdinal: action.ordinal, attemptNumber },
        recorder
      );
      let transportStatus: TransportStatus = "SUCCESS_RESPONSE";
      let response: AdapterMutationResult | null = null;
      let error: ReturnType<typeof normalizeError> | null = null;
      let delegateDefinitelyNotCalled = false;
      try {
        response = await callAction(faulted, run.claim_id, action, {
          expectedVersion,
          idempotencyKey: action.idempotencyKey,
          attemptNumber
        });
        transportStatus = response.transportStatus;
        await trace(runId, action.id, attemptId, "ADAPTER_RETURNED", "INFO", "Adapter returned transport evidence.", response);
      } catch (caught) {
        error = normalizeError(caught);
        transportStatus = transportFromError(caught);
        delegateDefinitelyNotCalled = recorder.injected.some((item) => item.phase === "BEFORE_WRITE" && item.fault !== "EXTERNAL_VERSION_BUMP");
        await trace(runId, action.id, attemptId, "ADAPTER_ERROR", "WARN", error.message, error);
      }
      for (const fault of recorder.injected) {
        await trace(runId, action.id, attemptId, "FAULT_INJECTED", "WARN", fault.summary, fault);
      }

      let postState: ClaimAggregate | undefined;
      let readError: { code: string; message: string } | undefined;
      try {
        postState = await faulted.getClaim(run.claim_id);
        await snapshot(runId, action.id, attemptId, "POST_ATTEMPT", postState);
        await trace(runId, action.id, attemptId, "POST_STATE_READ", "INFO", "Authoritative post-attempt read-back succeeded.", {
          version: postState.version
        });
      } catch (caught) {
        const normalized = normalizeError(caught);
        readError = { code: normalized.code, message: normalized.message };
        await insertFailedSnapshot(runId, action.id, attemptId, "POST_ATTEMPT", readError.code);
        await trace(runId, action.id, attemptId, "POST_STATE_READ_FAILED", "ERROR", normalized.message, normalized);
      }

      await finishAttempt(attemptId, {
        transportStatus,
        response,
        error
      });
      await pool.query("UPDATE planned_actions SET status = 'RECONCILING' WHERE id = $1", [action.id]);
      const desiredEffect = desiredEffectForAction({
        actionType: action.actionType,
        argumentsJson: action.argumentsJson,
        idempotencyKey: action.idempotencyKey
      });
      const reconciliation = reconcile({
        action,
        desiredEffect,
        preState,
        attempt: {
          transportStatus,
          errorCode: error?.code ?? null,
          errorMessage: error?.message ?? null,
          delegateDefinitelyNotCalled,
          versionConflict: error?.code === "VERSION_CONFLICT" || caughtVersionConflict(response)
        },
        postState,
        postStateReadError: readError
      });
      await pool.query(
        `
          INSERT INTO reconciliations (
            attempt_id, status, desired_effect_json, observed_effect_json, evidence_json, reason_code, reason_summary
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          attemptId,
          reconciliation.status,
          JSON.stringify(reconciliation.desiredEffect),
          reconciliation.observedEffect ? JSON.stringify(reconciliation.observedEffect) : null,
          JSON.stringify(reconciliation.evidence),
          reconciliation.reasonCode,
          reconciliation.reasonSummary
        ]
      );
      await trace(runId, action.id, attemptId, "RECONCILIATION_COMPLETED", "INFO", reconciliation.reasonSummary, {
        status: reconciliation.status,
        evidence: reconciliation.evidence
      });
      const recovery = decideRecovery({
        action,
        reconciliation,
        attemptCount: attemptNumber,
        maxAttempts: retryLimitForProfile(profile, action.ordinal)
      });
      await recordRecovery(runId, action.id, attemptId, recovery.decision, recovery.reasonCode, recovery.reasonSummary);
      await trace(runId, action.id, attemptId, "RECOVERY_SELECTED", "INFO", recovery.reasonSummary, recovery);

      if (recovery.decision === "COMPLETE") {
        await pool.query("UPDATE planned_actions SET status = 'COMPLETED' WHERE id = $1", [action.id]);
        expectedVersion = postState?.version ?? response?.returnedVersion ?? expectedVersion + 1;
      } else if (recovery.decision === "RETRY_ACTION") {
        await pool.query("UPDATE planned_actions SET status = 'RETRY_SCHEDULED' WHERE id = $1", [action.id]);
        await updateRunStatus(runId, "RETRYING", false);
        continueSameAction = true;
      } else if (recovery.decision === "REPLAN_REQUIRED") {
        await pool.query("UPDATE planned_actions SET status = 'REPLAN_REQUIRED' WHERE id = $1", [action.id]);
        await updateRunStatus(runId, "REPLAN_REQUIRED", true);
        await trace(runId, action.id, attemptId, "RUN_REPLAN_REQUIRED", "WARN", "Run requires replan.", recovery);
        return { runId, status: "REPLAN_REQUIRED" };
      } else if (recovery.decision === "MANUAL_INVESTIGATION_REQUIRED") {
        await pool.query("UPDATE planned_actions SET status = 'MANUAL_INVESTIGATION' WHERE id = $1", [action.id]);
        await updateRunStatus(runId, "MANUAL_INVESTIGATION", true);
        await trace(runId, action.id, attemptId, "RUN_MANUAL_INVESTIGATION", "ERROR", "Run requires manual investigation.", recovery);
        return { runId, status: "MANUAL_INVESTIGATION" };
      } else {
        await pool.query("UPDATE planned_actions SET status = 'BLOCKED_PRECONDITION' WHERE id = $1", [action.id]);
        await updateRunStatus(runId, "FAILED_CLOSED", true);
        return { runId, status: "FAILED_CLOSED" };
      }
    }
  }
  await updateRunStatus(runId, "COMPLETED", true);
  await trace(runId, null, null, "RUN_COMPLETED", "INFO", "All planned effects confirmed.", {});
  return { runId, status: "COMPLETED" };
}

export async function decideReview(input: {
  reviewId: string;
  decision: "APPROVE" | "REJECT";
  note?: string;
  actorId: string;
}): Promise<{ runId: string; status: RunStatus }> {
  if (!canActorReview(input.actorId)) {
    throw new Error("Reviewer role required.");
  }
  const reviewResult = await pool.query<{
    id: string;
    run_id: string;
    planned_action_id: string;
    status: string;
    claim_snapshot_json: ClaimAggregate;
  }>("SELECT * FROM review_requests WHERE id = $1", [input.reviewId]);
  const review = reviewResult.rows[0];
  if (!review || review.status !== "PENDING") {
    throw new Error("Review request is not pending.");
  }
  const run = await getRunRow(review.run_id);
  const action = (await getActionsForRun(review.run_id)).find((item) => item.id === review.planned_action_id);
  if (!action) {
    throw new Error("Planned action for review not found.");
  }
  if (input.decision === "REJECT") {
    await pool.query(
      "UPDATE review_requests SET status = 'REJECTED', decided_at = now(), decided_by_actor_id = $1, decision_note = $2 WHERE id = $3",
      [input.actorId, input.note ?? null, input.reviewId]
    );
    await pool.query("UPDATE planned_actions SET status = 'REJECTED' WHERE id = $1", [action.id]);
    await updateRunStatus(review.run_id, "FAILED_CLOSED", true);
    await trace(review.run_id, action.id, null, "REVIEW_REJECTED", "WARN", "Reviewer rejected the action.", {
      note: input.note ?? null
    });
    return { runId: review.run_id, status: "FAILED_CLOSED" };
  }
  const adapter = new ClaimsEnterpriseAdapter();
  const current = await adapter.getClaim(run.claim_id);
  if (current.version !== action.expectedVersionAtPlan) {
    await pool.query(
      "UPDATE review_requests SET status = 'INVALIDATED', decided_at = now(), decided_by_actor_id = $1, decision_note = $2 WHERE id = $3",
      [input.actorId, input.note ?? "Invalidated by source-of-record version change.", input.reviewId]
    );
    await pool.query("UPDATE planned_actions SET status = 'REPLAN_REQUIRED' WHERE id = $1", [action.id]);
    await updateRunStatus(review.run_id, "REPLAN_REQUIRED", true);
    await trace(review.run_id, action.id, null, "RUN_REPLAN_REQUIRED", "WARN", "Review invalidated by current claim state.", {
      expectedVersion: action.expectedVersionAtPlan,
      observedVersion: current.version
    });
    return { runId: review.run_id, status: "REPLAN_REQUIRED" };
  }
  await pool.query(
    "UPDATE review_requests SET status = 'APPROVED', decided_at = now(), decided_by_actor_id = $1, decision_note = $2 WHERE id = $3",
    [input.actorId, input.note ?? null, input.reviewId]
  );
  await pool.query("UPDATE planned_actions SET status = 'READY' WHERE id = $1", [action.id]);
  await trace(review.run_id, action.id, null, "REVIEW_APPROVED", "INFO", "Reviewer approved after state revalidation.", {
    currentVersion: current.version
  });
  await updateRunStatus(review.run_id, "EXECUTING", false);
  return executeRun(review.run_id);
}

export async function replayRun(runId: string): Promise<{ runId: string; status: RunStatus }> {
  const run = await getRunRow(runId);
  return createAndStartRun({
    claimId: run.claim_id,
    requestText: run.request_text,
    plannerMode: run.planner_mode as PlannerMode,
    faultProfileId: run.fault_profile_id,
    scenarioId: run.scenario_id,
    actorId: run.actor_id,
    replayOfRunId: runId
  });
}

export async function getRunDetail(runId: string) {
  const run = (await pool.query("SELECT * FROM workflow_runs WHERE id = $1", [runId])).rows[0];
  if (!run) return null;
  const plan = (await pool.query("SELECT * FROM action_plans WHERE run_id = $1", [runId])).rows[0] ?? null;
  const actions = plan
    ? (await pool.query("SELECT * FROM planned_actions WHERE plan_id = $1 ORDER BY ordinal", [plan.id])).rows
    : [];
  const attempts = (await pool.query("SELECT * FROM action_attempts WHERE planned_action_id = ANY($1::uuid[]) ORDER BY started_at, attempt_number", [actions.map((a) => a.id)])).rows;
  const reconciliations = attempts.length
    ? (await pool.query("SELECT * FROM reconciliations WHERE attempt_id = ANY($1::uuid[]) ORDER BY created_at", [attempts.map((a) => a.id)])).rows
    : [];
  const recoveries = actions.length
    ? (await pool.query("SELECT * FROM recovery_decisions WHERE run_id = $1 ORDER BY created_at", [runId])).rows
    : [];
  const snapshots = (await pool.query("SELECT * FROM state_snapshots WHERE run_id = $1 ORDER BY created_at", [runId])).rows;
  const reviews = (await pool.query("SELECT * FROM review_requests WHERE run_id = $1 ORDER BY requested_at", [runId])).rows;
  const events = (await pool.query("SELECT * FROM trace_events WHERE run_id = $1 ORDER BY id", [runId])).rows;
  const latestSuccessfulPostSnapshot = snapshots
    .filter((snapshot) => snapshot.kind === "POST_ATTEMPT" && snapshot.read_status === "SUCCESS")
    .at(-1);
  let finalClaim: ClaimAggregate | null = latestSuccessfulPostSnapshot?.state_json ?? null;
  try {
    finalClaim = finalClaim ?? (await new ClaimsEnterpriseAdapter().getClaim(run.claim_id));
  } catch {
    finalClaim = null;
  }
  return { run, plan, actions, attempts, reconciliations, recoveries, snapshots, reviews, events, finalClaim };
}

export async function listRuns() {
  const result = await pool.query(`
    SELECT
      wr.*,
      fp.name AS fault_name,
      COALESCE((SELECT count(*) FROM action_attempts aa JOIN planned_actions pa ON pa.id = aa.planned_action_id JOIN action_plans ap ON ap.id = pa.plan_id WHERE ap.run_id = wr.id), 0)::int AS attempt_count,
      (SELECT reason_summary FROM recovery_decisions rd WHERE rd.run_id = wr.id ORDER BY rd.created_at DESC LIMIT 1) AS blocker
    FROM workflow_runs wr
    LEFT JOIN fault_profiles fp ON fp.id = wr.fault_profile_id
    ORDER BY wr.created_at DESC
    LIMIT 50
  `);
  return result.rows;
}

export async function listPendingReviews() {
  const result = await pool.query(`
    SELECT rr.*, wr.claim_id, wr.request_text, pa.action_type, pa.arguments_json, pa.risk_level, pa.expected_version_at_plan
    FROM review_requests rr
    JOIN workflow_runs wr ON wr.id = rr.run_id
    JOIN planned_actions pa ON pa.id = rr.planned_action_id
    WHERE rr.status = 'PENDING'
    ORDER BY rr.requested_at ASC
  `);
  return result.rows;
}

async function loadFaultProfile(id?: string | null): Promise<{ id: string; config: FaultProfileConfig }> {
  const fallback = getSeededFaultProfile(id);
  const result = await pool.query<{ id: string; config_json: FaultProfileConfig }>(
    "SELECT id, config_json FROM fault_profiles WHERE id = $1",
    [id ?? fallback.id]
  );
  const row = result.rows[0];
  return row
    ? { id: row.id, config: FaultProfileConfigSchema.parse(row.config_json) }
    : { id: fallback.id, config: fallback.config };
}

function draftToArguments(draft: ActionDraft): ActionArguments {
  switch (draft.type) {
    case "SET_RESERVE":
      return { reserveAmountCents: draft.reserveAmountCents };
    case "SCHEDULE_INSPECTION":
      return { network: draft.network };
    case "ISSUE_SETTLEMENT":
      return { amountCents: draft.amountCents };
    case "ADD_CLAIM_NOTE":
      return { body: draft.body };
  }
}

async function getRunRow(runId: string) {
  const result = await pool.query<{
    id: string;
    claim_id: string;
    request_text: string;
    planner_mode: string;
    fault_profile_id: string | null;
    scenario_id: string | null;
    actor_id: string;
  }>("SELECT * FROM workflow_runs WHERE id = $1", [runId]);
  const row = result.rows[0];
  if (!row) throw new Error(`Run ${runId} not found`);
  return row;
}

async function getActionsForRun(runId: string): Promise<PlannedActionRecord[]> {
  const result = await pool.query<DbActionRow>(
    `
      SELECT pa.*
      FROM planned_actions pa
      JOIN action_plans ap ON ap.id = pa.plan_id
      WHERE ap.run_id = $1
      ORDER BY pa.ordinal
    `,
    [runId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    planId: row.plan_id,
    ordinal: row.ordinal,
    actionType: row.action_type,
    argumentsJson: row.arguments_json,
    riskLevel: row.risk_level,
    expectedVersionAtPlan: row.expected_version_at_plan,
    idempotencyKey: row.idempotency_key,
    status: row.status
  }));
}

async function callAction(adapter: ClaimsEnterpriseAdapter | FaultInjectingAdapter, claimId: string, action: PlannedActionRecord, ctx: MutationContext) {
  switch (action.actionType) {
    case "SET_RESERVE":
      return adapter.setReserve({ claimId, reserveAmountCents: (action.argumentsJson as { reserveAmountCents: number }).reserveAmountCents }, ctx);
    case "SCHEDULE_INSPECTION":
      return adapter.scheduleInspection({ claimId, network: (action.argumentsJson as { network: string }).network }, ctx);
    case "ISSUE_SETTLEMENT":
      return adapter.issueSettlement({ claimId, amountCents: (action.argumentsJson as { amountCents: number }).amountCents }, ctx);
    case "ADD_CLAIM_NOTE":
      return adapter.addClaimNote({ claimId, body: (action.argumentsJson as { body: string }).body }, ctx);
  }
}

function transportFromError(error: unknown): TransportStatus {
  if (error instanceof EnterpriseTimeoutError) return "TIMEOUT";
  if (error instanceof EnterpriseTransientError) return "TRANSIENT_ERROR";
  if (error instanceof EnterpriseVersionConflictError) return "VERSION_CONFLICT";
  if (error instanceof EnterpriseMalformedResponseError) return "MALFORMED_RESPONSE";
  return "UNKNOWN_ERROR";
}

function caughtVersionConflict(response: AdapterMutationResult | null): boolean {
  return response?.transportStatus === "VERSION_CONFLICT";
}

function retryLimitForProfile(profile: FaultProfileConfig, actionOrdinal: number): number {
  const maxRuleAttempt = Math.max(
    0,
    ...profile.rules.filter((rule) => rule.actionOrdinal === actionOrdinal).map((rule) => rule.attemptNumber)
  );
  return Math.max(MAX_ATTEMPTS, maxRuleAttempt);
}

async function insertAttempt(
  id: string,
  action: PlannedActionRecord,
  attemptNumber: number,
  expectedVersion: number,
  transportStatus: TransportStatus
) {
  await pool.query(
    `
      INSERT INTO action_attempts (
        id, planned_action_id, attempt_number, expected_version, idempotency_key, transport_status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [id, action.id, attemptNumber, expectedVersion, action.idempotencyKey, transportStatus]
  );
}

async function finishAttempt(
  id: string,
  input: {
    transportStatus: TransportStatus;
    response: AdapterMutationResult | null;
    error: ReturnType<typeof normalizeError> | null;
  }
) {
  await pool.query(
    `
      UPDATE action_attempts
      SET finished_at = now(),
          transport_status = $1,
          adapter_operation_id = $2,
          response_json = $3,
          error_code = $4,
          error_message = $5
      WHERE id = $6
    `,
    [
      input.transportStatus,
      input.response?.operationId ?? null,
      input.response?.responseJson ? JSON.stringify(input.response.responseJson) : null,
      input.error?.code ?? null,
      input.error?.message ?? null,
      id
    ]
  );
}

async function snapshot(
  runId: string,
  actionId: string | null,
  attemptId: string | null,
  kind: string,
  claim: ClaimAggregate
) {
  await pool.query(
    `
      INSERT INTO state_snapshots (
        run_id, planned_action_id, attempt_id, kind, claim_version, state_json, read_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS')
    `,
    [runId, actionId, attemptId, kind, claim.version, JSON.stringify(claim)]
  );
}

async function insertFailedSnapshot(
  runId: string,
  actionId: string,
  attemptId: string,
  kind: string,
  errorCode: string
) {
  await pool.query(
    `
      INSERT INTO state_snapshots (
        run_id, planned_action_id, attempt_id, kind, state_json, read_status, read_error_code
      )
      VALUES ($1, $2, $3, $4, '{}', 'FAILED', $5)
    `,
    [runId, actionId, attemptId, kind, errorCode]
  );
}

async function createReview(
  runId: string,
  actionId: string,
  reasonCode: string,
  reasonSummary: string,
  claim: ClaimAggregate
) {
  await pool.query(
    `
      INSERT INTO review_requests (
        run_id, planned_action_id, status, reason_code, policy_snapshot_json, claim_snapshot_json
      )
      VALUES ($1, $2, 'PENDING', $3, $4, $5)
    `,
    [
      runId,
      actionId,
      reasonCode,
      JSON.stringify({ reasonCode, reasonSummary, thresholdCents: AUTONOMOUS_SETTLEMENT_LIMIT_CENTS }),
      JSON.stringify(claim)
    ]
  );
  await trace(runId, actionId, null, "REVIEW_CREATED", "WARN", reasonSummary, { reasonCode });
  await recordRecovery(runId, actionId, null, "HUMAN_REVIEW_REQUIRED", reasonCode, reasonSummary);
}

async function markActionAndRunReplan(
  runId: string,
  actionId: string,
  expectedVersion: number,
  observedVersion: number
) {
  await pool.query("UPDATE planned_actions SET status = 'REPLAN_REQUIRED' WHERE id = $1", [actionId]);
  await recordRecovery(
    runId,
    actionId,
    null,
    "REPLAN_REQUIRED",
    "VERSION_CHAIN_CONFLICT",
    `Expected claim version ${expectedVersion}, observed ${observedVersion}.`
  );
  await updateRunStatus(runId, "REPLAN_REQUIRED", true);
  await trace(runId, actionId, null, "RUN_REPLAN_REQUIRED", "WARN", "Version chain conflict requires replan.", {
    expectedVersion,
    observedVersion
  });
}

async function recordRecovery(
  runId: string,
  actionId: string,
  attemptId: string | null,
  decision: string,
  reasonCode: string,
  reasonSummary: string
) {
  await pool.query(
    `
      INSERT INTO recovery_decisions (
        run_id, planned_action_id, attempt_id, decision, reason_code, reason_summary
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [runId, actionId, attemptId, decision, reasonCode, reasonSummary]
  );
}

async function trace(
  runId: string,
  actionId: string | null,
  attemptId: string | null,
  eventType: string,
  severity: "INFO" | "WARN" | "ERROR",
  summary: string,
  details: unknown
) {
  await pool.query(
    `
      INSERT INTO trace_events (
        run_id, planned_action_id, attempt_id, event_type, severity, summary, details_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [runId, actionId, attemptId, eventType, severity, summary, JSON.stringify(details)]
  );
}

async function updateRunStatus(runId: string, status: RunStatus, terminal: boolean) {
  await pool.query(
    `UPDATE workflow_runs SET status = $1, completed_at = ${terminal ? "now()" : "NULL"} WHERE id = $2`,
    [status, runId]
  );
}

async function countAttempts(actionId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    "SELECT count(*) FROM action_attempts WHERE planned_action_id = $1",
    [actionId]
  );
  return Number(result.rows[0]?.count ?? 0);
}
