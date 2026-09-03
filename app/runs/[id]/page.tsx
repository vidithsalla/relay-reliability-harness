import { notFound } from "next/navigation";

import { replayRunAction } from "@/app/actions";
import { getRunDetail } from "@/lib/services/run-service";
import { money, shortId, titleize } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getRunDetail(id);
  if (!detail) notFound();
  const firstAction = detail.actions[0];
  const firstAttempt = detail.attempts[0];
  const firstReconciliation = detail.reconciliations[0];
  const lastRecovery = detail.recoveries[detail.recoveries.length - 1];
  const prePlan = detail.snapshots.find((snapshot) => snapshot.kind === "PRE_PLAN");
  const postSnapshots = detail.snapshots.filter((snapshot) => snapshot.kind === "POST_ATTEMPT");
  const latestPost = postSnapshots[postSnapshots.length - 1];

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>{detail.run.claim_id} Reliability Trace</h1>
          <p>{detail.run.request_text}</p>
          <p>
            Planner: {detail.run.planner_mode} · Fault: {detail.run.fault_profile_id ?? "none"} · Run{" "}
            {shortId(detail.run.id)}
          </p>
        </div>
        <div>
          <span className={`badge status-${detail.run.status}`}>{titleize(detail.run.status)}</span>
          <form action={replayRunAction} style={{ marginTop: 10 }}>
            <input type="hidden" name="runId" value={detail.run.id} />
            <button className="button secondary" type="submit">
              Replay
            </button>
          </form>
        </div>
      </div>

      <section className="panel">
        <div className="pipeline">
          {["REQUEST", "PLAN", "POLICY", "EXECUTE", "READ BACK", "RECONCILE", "RECOVER"].map((stage) => (
            <div className="stage" key={stage}>
              {stage}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Intent vs Reality</h2>
        <div className="intent-grid">
          <div className="fact">
            <strong>Intended</strong>
            <span>{firstAction ? actionSummary(firstAction) : "No executable action"}</span>
          </div>
          <div className="fact">
            <strong>Transport</strong>
            <span>{firstAttempt ? titleize(firstAttempt.transport_status) : "No adapter attempt"}</span>
          </div>
          <div className="fact">
            <strong>Observed authoritative state</strong>
            <span>
              Reserve {money(detail.finalClaim?.reserveAmountCents)} · version {detail.finalClaim?.version ?? "n/a"} ·
              inspections {detail.finalClaim?.inspections.length ?? 0} · settlements{" "}
              {detail.finalClaim?.settlements.length ?? 0}
            </span>
          </div>
          <div className="fact">
            <strong>Conclusion</strong>
            <span className={`badge status-${firstReconciliation?.status ?? detail.run.status}`}>
              {titleize(firstReconciliation?.status ?? detail.run.status)}
            </span>
            <p>{lastRecovery?.reason_summary ?? firstReconciliation?.reason_summary ?? "Awaiting recovery decision."}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Action Stack</h2>
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
                  <td>
                    {actionAttempts.length
                      ? [...new Set(actionAttempts.map((attempt) => attempt.expected_version))].join(" -> ")
                      : action.expected_version_at_plan}
                  </td>
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
        <h2>Attempt Timeline</h2>
        <div className="timeline">
          {detail.events.map((event) => (
            <div className={`event ${event.severity}`} key={event.id}>
              <strong>{titleize(event.event_type)}</strong>
              <p>{event.summary}</p>
              <p className="muted">{new Date(event.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
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
