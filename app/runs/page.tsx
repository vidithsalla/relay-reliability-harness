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
          <h1>Runs</h1>
          <p>Persisted reliability traces from request through recovery decision.</p>
        </div>
      </div>
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Claim</th>
              <th>Scenario</th>
              <th>Fault</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Next action / blocker</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <Link href={`/runs/${run.id}`}>{shortId(run.id)}</Link>
                  <div className="muted">{new Date(run.created_at).toLocaleString()}</div>
                </td>
                <td>{run.claim_id}</td>
                <td>{titleize(run.scenario_id)}</td>
                <td>{run.fault_name ?? run.fault_profile_id ?? "None"}</td>
                <td>
                  <span className={`badge status-${run.status}`}>{titleize(run.status)}</span>
                </td>
                <td>{run.attempt_count}</td>
                <td>{run.blocker ?? "All effects confirmed or awaiting execution."}</td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={7}>No runs yet. Launch a scenario first.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
