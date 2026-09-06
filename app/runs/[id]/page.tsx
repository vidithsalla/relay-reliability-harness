import { notFound } from "next/navigation";

import { replayRunAction } from "@/app/actions";
import { getRunDetail } from "@/lib/services/run-service";
import { money, shortId, titleize } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

type ClaimUiState = {
  reserveAmountCents: number;
  version: number;
  inspections: Array<unknown>;
  settlements: Array<unknown>;
};

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getRunDetail(id);
  if (!detail) notFound();

  const highlightedAction = selectHighlightedAction(detail);
  const highlightedAttempts = highlightedAction
    ? detail.attempts.filter((attempt) => attempt.planned_action_id === highlightedAction.id)
    : [];
  const highlightedAttempt =
    detail.run.status === "MANUAL_INVESTIGATION" ? highlightedAttempts.at(-1) : highlightedAttempts[0];
  const highlightedReconciliation = highlightedAttempt
    ? detail.reconciliations.find((item) => item.attempt_id === highlightedAttempt.id)
    : undefined;
  const highlightedRecovery =
    (highlightedAttempt ? detail.recoveries.find((item) => item.attempt_id === highlightedAttempt.id) : undefined) ??
    (highlightedAction ? detail.recoveries.filter((item) => item.planned_action_id === highlightedAction.id).at(-1) : undefined);
  const lastRecovery = detail.recoveries[detail.recoveries.length - 1];
  const prePlan = detail.snapshots.find((snapshot) => snapshot.kind === "PRE_PLAN");
  const postSnapshots = detail.snapshots.filter((snapshot) => snapshot.kind === "POST_ATTEMPT");
  const latestPost = postSnapshots[postSnapshots.length - 1];
  const highlightedReadback =
    postSnapshots.find((snapshot) => snapshot.planned_action_id === highlightedAction?.id) ?? latestPost;
  const highlightedReadbackState =
    highlightedReadback?.read_status === "SUCCESS" ? (highlightedReadback.state_json as ClaimUiState) : null;
  const highlightedActionRejected = highlightedAction?.status === "REJECTED";
  const operatorDecision = operatorDecisionFor(
    detail.run.status,
    highlightedReconciliation?.status,
    highlightedRecovery?.reason_code,
    detail.actions.some((action) => action.status === "REJECTED")
  );

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>{detail.run.claim_id} Execution Trace</h1>
          <p>{detail.run.request_text}</p>
          <p>
            Planner: {detail.run.planner_mode} · Fault: {faultLabel(detail.run.fault_profile_id)} · Trace{" "}
            {shortId(detail.run.id)}
          </p>
        </div>
        <div className="header-actions">
          <span className={`badge status-${detail.run.status}`}>{titleize(detail.run.status)}</span>
          <form action={replayRunAction}>
            <input type="hidden" name="runId" value={detail.run.id} />
            <button className="button secondary" type="submit">
              Replay
            </button>
          </form>
        </div>
      </div>

      <section className="panel">
        <div className="pipeline">
          {[
            ["REQUEST", "captured"],
            ["PLAN", detail.plan ? "typed" : "blocked"],
            ["POLICY", detail.actions.some((action) => action.status === "WAITING_REVIEW") ? "review" : "checked"],
            ["EXECUTE", detail.attempts.length ? "attempted" : "not run"],
            ["READ BACK", postSnapshots.length ? "observed" : "pending"],
            ["RECONCILE", detail.reconciliations.length ? "classified" : "pending"],
            ["RECOVER", lastRecovery ? titleize(lastRecovery.decision) : "pending"],
            ["HUMAN", humanStage(detail.events)]
          ].map(([stage, state]) => (
            <div className="stage" key={stage}>
              <span>{stage}</span>
              <small>{state}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="proof-panel">
        <div className="proof-header">
          <div>
            <h2>Intent vs Observed Proof</h2>
            <p>
              The planner proposed intent. Relay attempted the enterprise action, read the source of record, reconciled the
              mismatch, and selected a safe recovery path.
            </p>
          </div>
          <div className="retry-verdict">
            <span className={`badge status-${highlightedReconciliation?.status ?? detail.run.status}`}>
              {titleize(highlightedReconciliation?.status ?? detail.run.status)}
            </span>
            <strong>
              {retryVerdict(
                highlightedAttempts.length,
                highlightedReconciliation?.status,
                highlightedRecovery?.decision,
                detail.run.status
              )}
            </strong>
          </div>
        </div>
        <div className="proof-grid">
          <ProofStep
            number="1"
            label="Intended state"
            value={highlightedAction ? actionSummary(highlightedAction) : "No executable action"}
            note="Typed plan only. It is not authorization and not execution truth."
          />
          <ProofStep
            number="2"
            label="API result"
            value={
              highlightedAttempt
                ? `${adapterCallLabel(highlightedAction)} -> ${titleize(highlightedAttempt.transport_status)}`
                : "No adapter attempt"
            }
            note={apiResultNote(highlightedAttempt?.transport_status)}
          />
          <ProofStep
            number="3"
            label="Observed state"
            value={
              !highlightedReadback
                ? "No post-attempt read-back yet"
                : highlightedReadback.read_status === "SUCCESS"
                ? observedSummary(highlightedAction, highlightedReadbackState)
                : "Authoritative read-back failed"
            }
            note={
              !highlightedReadback
                ? "Execution has not started, so Relay has no post-attempt source-of-record evidence."
                : highlightedReadback.read_status === "SUCCESS"
                ? `Authoritative read-back after this action: version ${highlightedReadback.claim_version ?? "n/a"}.`
                : "Relay does not infer success or failure without source-of-record evidence."
            }
          />
          <ProofStep
            number="4"
            label="Reconciled state"
            value={titleize(highlightedReconciliation?.status ?? detail.run.status)}
            note={highlightedReconciliation?.reason_summary ?? "No reconciliation result yet."}
          />
          <ProofStep
            number="5"
            label="Recovery"
            value={
              highlightedActionRejected
                ? "Rejected"
                : highlightedRecovery
                  ? titleize(highlightedRecovery.decision)
                  : titleize(detail.run.status)
            }
            note={
              highlightedActionRejected
                ? "Reviewer rejected the action. Relay made no adapter call."
                : (highlightedRecovery?.reason_summary ?? operatorDecision.summary)
            }
          />
        </div>
      </section>

      <section className={`operator-panel status-${detail.run.status}`}>
        <div>
          <h2>Operator Decision</h2>
          <p>{operatorDecision.summary}</p>
        </div>
        <div className="operator-next-step">
          <strong>Next safe step</strong>
          <span>{operatorDecision.nextStep}</span>
        </div>
      </section>

      <section className="panel">
        <h2>Action Evidence</h2>
        <div className="evidence-stack">
          {detail.actions.map((action) => {
            const actionAttempts = detail.attempts.filter((attempt) => attempt.planned_action_id === action.id);
            const recs = detail.reconciliations.filter((item) =>
              actionAttempts.some((attempt) => attempt.id === item.attempt_id)
            );
            const rec = recs.at(-1);
            const recovery = detail.recoveries.filter((item) => item.planned_action_id === action.id).at(-1);
            return (
              <article className="evidence-row" key={action.id}>
                <div>
                  <span className="eyebrow">Action {action.ordinal}</span>
                  <h3>{actionSummary(action)}</h3>
                  <p>
                    Risk {action.risk_level} · expected version{" "}
                    {expectedVersionLabel(actionAttempts, action.expected_version_at_plan)}
                  </p>
                </div>
                <div className="evidence-cells">
                  <div>
                    <strong>API result</strong>
                    <span>{actionAttempts.map((attempt) => titleize(attempt.transport_status)).join(" -> ") || "Not attempted"}</span>
                  </div>
                  <div>
                    <strong>Read-back result</strong>
                    <span>{readbackLabel(detail.snapshots, action.id)}</span>
                  </div>
                  <div>
                    <strong>Reconciled state</strong>
                    <span className={`badge status-${rec?.status ?? action.status}`}>{titleize(rec?.status ?? action.status)}</span>
                  </div>
                  <div>
                    <strong>Recovery</strong>
                    <span>{recovery ? titleize(recovery.decision) : "Pending"}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Source-of-Record State</h2>
        <div className="state-grid">
          <div className="fact">
            <strong>Claim</strong>
            <span>
              {detail.finalClaim?.id ?? detail.run.claim_id} · {detail.finalClaim?.status ?? "unknown"} · version{" "}
              {detail.finalClaim?.version ?? "n/a"}
            </span>
          </div>
          <div className="fact">
            <strong>Reserve</strong>
            <span>{money(detail.finalClaim?.reserveAmountCents)}</span>
          </div>
          <div className="fact">
            <strong>Child effects</strong>
            <span>
              inspections {detail.finalClaim?.inspections.length ?? 0} · settlements{" "}
              {detail.finalClaim?.settlements.length ?? 0} · notes {detail.finalClaim?.notes.length ?? 0}
            </span>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Compact Action Table</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Risk</th>
              <th>Expected version</th>
              <th>Attempts</th>
              <th>Reconciliation</th>
              <th>Recovery</th>
            </tr>
          </thead>
          <tbody>
            {detail.actions.map((action) => {
              const actionAttempts = detail.attempts.filter((attempt) => attempt.planned_action_id === action.id);
              const rec = detail.reconciliations
                .filter((item) => actionAttempts.some((attempt) => attempt.id === item.attempt_id))
                .at(-1);
              const recovery = detail.recoveries.filter((item) => item.planned_action_id === action.id).at(-1);
              return (
                <tr key={action.id}>
                  <td>{actionSummary(action)}</td>
                  <td>{action.risk_level}</td>
                  <td>{expectedVersionLabel(actionAttempts, action.expected_version_at_plan)}</td>
                  <td>{actionAttempts.length}</td>
                  <td>
                    {rec ? <span className={`badge status-${rec.status}`}>{titleize(rec.status)}</span> : titleize(action.status)}
                  </td>
                  <td>{recovery ? titleize(recovery.decision) : "Pending"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Version Trace</h2>
        <p>
          Pre-plan version {prePlan?.claim_version ?? "n/a"} · latest read-back version{" "}
          {latestPost?.claim_version ?? "n/a"} · final source-of-record version {detail.finalClaim?.version ?? "n/a"}
        </p>
      </section>

      <section className="panel">
        <h2>Audit Timeline</h2>
        <div className="audit-timeline">
          {detail.events.map((event) => (
            <div className={`audit-event ${event.severity}`} key={event.id}>
              <span className="event-category">{eventCategory(event.event_type)}</span>
              <div>
                <strong>{titleize(event.event_type)}</strong>
                <p>{event.summary}</p>
              </div>
              <time>{new Date(event.created_at).toLocaleString()}</time>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function ProofStep(props: { number: string; label: string; value: string; note: string }) {
  return (
    <div className="proof-step">
      <span className="step-number">{props.number}</span>
      <strong>{props.label}</strong>
      <b>{props.value}</b>
      <p>{props.note}</p>
    </div>
  );
}

function actionSummary(action: { action_type: string; arguments_json: Record<string, unknown> }) {
  if (action.action_type === "SET_RESERVE") {
    return `Set reserve to ${money(action.arguments_json.reserveAmountCents as number)}`;
  }
  if (action.action_type === "SCHEDULE_INSPECTION") {
    return `Schedule inspection with ${String(action.arguments_json.network)}`;
  }
  if (action.action_type === "ISSUE_SETTLEMENT") {
    return `Issue settlement for ${money(action.arguments_json.amountCents as number)}`;
  }
  return `Add note: ${String(action.arguments_json.body ?? "")}`;
}

function adapterCallLabel(action?: { action_type: string }) {
  if (!action) return "Adapter call";
  if (action.action_type === "SET_RESERVE") return "SET_RESERVE";
  if (action.action_type === "SCHEDULE_INSPECTION") return "SCHEDULE_INSPECTION";
  if (action.action_type === "ISSUE_SETTLEMENT") return "ISSUE_SETTLEMENT";
  if (action.action_type === "ADD_NOTE") return "ADD_NOTE";
  return titleize(action.action_type);
}

function selectHighlightedAction(detail: {
  actions: Array<{ id: string; action_type: string; arguments_json: Record<string, unknown>; status: string }>;
  attempts: Array<{ planned_action_id: string; transport_status: string }>;
}) {
  const notableAttempt = detail.attempts.find(
    (attempt) => attempt.transport_status !== "SUCCESS_RESPONSE" && attempt.transport_status !== "IDEMPOTENT_REPLAY"
  );
  return detail.actions.find((action) => action.id === notableAttempt?.planned_action_id) ?? detail.actions[0];
}

function observedSummary(
  action: { action_type: string; arguments_json: Record<string, unknown> } | undefined,
  claim: ClaimUiState | null
) {
  if (!claim) return "No authoritative state available";
  if (action?.action_type === "SET_RESERVE") {
    return `reserve ${money(claim.reserveAmountCents)} in source of record`;
  }
  if (action?.action_type === "SCHEDULE_INSPECTION") {
    return `inspections ${claim.inspections.length} in source of record`;
  }
  if (action?.action_type === "ISSUE_SETTLEMENT") {
    return `settlements ${claim.settlements.length} in source of record`;
  }
  return `reserve ${money(claim.reserveAmountCents)} · version ${claim.version} · inspections ${claim.inspections.length} · settlements ${claim.settlements.length}`;
}

function faultLabel(faultProfileId: string | null) {
  if (!faultProfileId || faultProfileId === "none") return "none";
  if (faultProfileId === "timeout-after-write-reserve") return "timeout after write";
  if (faultProfileId === "timeout-before-write-reserve") return "timeout before write";
  if (faultProfileId === "partial-reserve-success-inspection-timeout-before") return "partial completion";
  if (faultProfileId === "stale-version-before-second-action") return "stale version conflict";
  if (faultProfileId === "ambiguous-write-and-readback-timeout") return "ambiguous write/read-back";
  if (faultProfileId === "retry-exhaustion-inspection") return "retry exhaustion";
  return titleize(faultProfileId);
}

function apiResultNote(status?: string) {
  if (status === "TIMEOUT") return "The call failed at the transport layer. Relay does not infer business failure from that.";
  if (status === "MALFORMED_RESPONSE") return "The response body was unusable. Relay relies on source-of-record read-back.";
  if (status === "IDEMPOTENT_REPLAY") return "The source of record returned the prior logical effect without a duplicate write.";
  if (status === "TRANSIENT_ERROR") return "Retry depends on read-back proving the effect was not applied.";
  if (!status) return "No adapter call was made.";
  return "Transport evidence is recorded separately from business truth.";
}

function retryVerdict(attemptCount: number, reconciliationStatus?: string, recoveryDecision?: string, runStatus?: string) {
  if (reconciliationStatus === "UNKNOWN") {
    return "No blind retry: manual investigation";
  }
  if (runStatus === "MANUAL_INVESTIGATION" && recoveryDecision === "MANUAL_INVESTIGATION_REQUIRED") {
    return "Retry limit reached: manual investigation";
  }
  if (reconciliationStatus === "CONFIRMED_APPLIED" && attemptCount === 1) {
    return "No retry: effect already observed";
  }
  if (reconciliationStatus === "NO_OP_DUPLICATE") {
    return "No-op duplicate: prior effect reused";
  }
  if (reconciliationStatus === "CONFIRMED_NOT_APPLIED" && attemptCount > 1) {
    return "Retried after absence was proven";
  }
  return `${attemptCount || 0} attempt${attemptCount === 1 ? "" : "s"} recorded`;
}

function operatorDecisionFor(
  status: string,
  reconciliationStatus?: string,
  recoveryReasonCode?: string,
  hasRejectedAction?: boolean
) {
  if (status === "COMPLETED") {
    return {
      summary: "No operator action is needed. Relay has authoritative evidence for every required effect or duplicate no-op.",
      nextStep: "Use the trace as proof or replay the scenario."
    };
  }
  if (status === "WAITING_REVIEW") {
    return {
      summary: "A known high-risk action is valid but needs reviewer authorization before execution.",
      nextStep: "Open the review queue, approve or reject, then Relay revalidates source state."
    };
  }
  if (status === "REPLAN_REQUIRED") {
    return {
      summary: "The planned expected version no longer matches the source of record. Relay stopped before overwriting state.",
      nextStep: "Start a new execution from current claim state."
    };
  }
  if (status === "MANUAL_INVESTIGATION") {
    if (reconciliationStatus === "CONFIRMED_NOT_APPLIED" || recoveryReasonCode === "RETRY_LIMIT_REACHED") {
      return {
        summary: "Relay proved the attempted effect is absent, but the automatic retry limit is exhausted.",
        nextStep: "Inspect the retry history and start a new execution only after confirming the source system is healthy."
      };
    }
    return {
      summary: "Relay cannot safely prove whether a mutation did or did not happen.",
      nextStep: "Inspect the source system and idempotency ledger before any retry."
    };
  }
  if (status === "FAILED_CLOSED") {
    if (hasRejectedAction) {
      return {
        summary: "A reviewer rejected the known high-risk action. Relay failed closed and made no adapter call.",
        nextStep: "Start a new execution only if the business request changes or a new approval decision is made."
      };
    }
    return {
      summary: "Deterministic policy blocked the action before adapter execution.",
      nextStep: "Correct the request or claim state, then start a new execution."
    };
  }
  return {
    summary: "Relay is still processing or waiting for the next deterministic step.",
    nextStep: "Refresh the trace or inspect the latest recovery decision."
  };
}

function expectedVersionLabel(attempts: Array<{ expected_version: number }>, plannedVersion: number) {
  if (!attempts.length) return String(plannedVersion);
  return [...new Set(attempts.map((attempt) => attempt.expected_version))].join(" -> ");
}

function readbackLabel(
  snapshots: Array<{ planned_action_id: string | null; kind: string; read_status: string; claim_version: number | null }>,
  actionId: string
) {
  const actionSnapshots = snapshots.filter(
    (snapshot) => snapshot.planned_action_id === actionId && snapshot.kind === "POST_ATTEMPT"
  );
  if (!actionSnapshots.length) return "Not read";
  return actionSnapshots
    .map((snapshot) => (snapshot.read_status === "SUCCESS" ? `success v${snapshot.claim_version ?? "n/a"}` : "failed"))
    .join(" -> ");
}

function eventCategory(eventType: string) {
  if (eventType.includes("PLAN")) return "Plan";
  if (eventType.includes("ACTION_READY") || eventType.includes("ACTION_BLOCKED")) return "Policy";
  if (eventType.includes("ATTEMPT")) return "Attempt";
  if (eventType.includes("FAULT")) return "Fault";
  if (eventType.includes("ADAPTER")) return "Adapter";
  if (eventType.includes("READ")) return "Read-back";
  if (eventType.includes("RECONCILIATION")) return "Reconcile";
  if (eventType.includes("RECOVERY")) return "Recover";
  if (eventType.includes("REVIEW")) return "Review";
  if (eventType.includes("RUN_COMPLETED") || eventType.includes("RUN_REPLAN") || eventType.includes("RUN_MANUAL")) {
    return "Final";
  }
  return "Request";
}

function humanStage(events: Array<{ event_type: string }>) {
  if (events.some((event) => event.event_type === "REVIEW_APPROVED")) return "approved";
  if (events.some((event) => event.event_type === "REVIEW_REJECTED")) return "rejected";
  if (events.some((event) => event.event_type === "REVIEW_CREATED")) return "pending";
  return "none";
}
