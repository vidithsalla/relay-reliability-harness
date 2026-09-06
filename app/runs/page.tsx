import Link from "next/link";

import { listRuns } from "@/lib/services/run-service";
import { shortId, titleize } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const runs = await listRuns();
  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Execution traces</h1>
          <p>Every saved execution, with the evidence Relay used to determine what happened and choose the next safe action.</p>
          <p>
            Each trace preserves intended action, API result, source-of-record read-back, reconciliation result, recovery
            decision, and human action where applicable.
          </p>
        </div>
      </div>
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Trace</th>
              <th>Scenario</th>
              <th>Outcome</th>
              <th>Evidence</th>
              <th>Recovery</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <Link href={`/runs/${run.id}`}>{shortId(run.id)}</Link>
                  <div className="muted">{run.claim_id}</div>
                </td>
                <td>
                  {titleize(run.scenario_id)}
                  <div className="muted">{run.fault_name ?? run.fault_profile_id ?? "No injected fault"}</div>
                </td>
                <td>
                  <span className={`badge status-${run.status}`}>{titleize(run.status)}</span>
                </td>
                <td>{run.attempt_count} attempts</td>
                <td>{run.blocker ?? "All effects confirmed or awaiting execution."}</td>
                <td>{new Date(run.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6}>No execution traces yet. Launch a scenario first.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
