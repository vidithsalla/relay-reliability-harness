import { runEvalAction } from "@/app/actions";
import { latestEvalRun } from "@/lib/eval/eval-suite";
import { titleize } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

export default async function EvalsPage() {
  const latest = await latestEvalRun();
  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Evals</h1>
          <p>Deterministic regression cases persisted from coordinator-level runs.</p>
        </div>
        <form action={runEvalAction}>
          <button className="button" type="submit">
            Run eval suite
          </button>
        </form>
      </div>
      <section className="panel">
        {latest ? (
          <>
            <h2>
              Latest suite: {latest.run.passed_cases}/{latest.run.total_cases} passed
            </h2>
            <p>
              Started {new Date(latest.run.started_at).toLocaleString()} · readiness{" "}
              {latest.run.failed_cases === 0 ? "READY_FOR_DEMO" : "NOT_READY_FOR_DEMO"}
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Status</th>
                  <th>Assertions</th>
                  <th>Failure</th>
                </tr>
              </thead>
              <tbody>
                {latest.cases.map((item) => (
                  <tr key={item.id}>
                    <td>{item.case_id}</td>
                    <td>
                      <span className={`badge status-${item.passed ? "COMPLETED" : "FAILED_CLOSED"}`}>
                        {item.passed ? "PASS" : "FAIL"}
                      </span>
                    </td>
                    <td>{(item.assertions_json as Array<{ passed: boolean }>).filter((a) => a.passed).length}/{(item.assertions_json as Array<unknown>).length}</td>
                    <td>{item.failure_summary ?? titleize("none")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p>No eval run has been persisted yet.</p>
        )}
      </section>
    </main>
  );
}
