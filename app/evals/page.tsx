import { runEvalAction } from "@/app/actions";
import { latestEvalRun } from "@/lib/eval/eval-suite";
import { canRunEvalMutation } from "@/lib/eval/permissions";
import { titleize } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

export default async function EvalsPage() {
  const latest = await latestEvalRun();
  const evalMutationAllowed = canRunEvalMutation();
  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Reliability evals</h1>
          <p>Deterministic regression cases that verify Relay chooses the expected safe outcome under each failure mode.</p>
        </div>
        {evalMutationAllowed ? (
          <form action={runEvalAction}>
            <button className="button" type="submit">
              Run eval suite
            </button>
          </form>
        ) : (
          <span className="badge">Read-only hosted demo</span>
        )}
      </div>
      <section className="panel">
        {latest ? (
          <>
            <h2>
              Latest suite: {latest.run.passed_cases}/{latest.run.total_cases} passed
            </h2>
            <p>
              These failure semantics are regression-tested: retry when absence is proven, do not retry when the effect
              already exists, replan on stale state, stop when the outcome cannot be proven, require review for high-risk
              actions, and prevent duplicate effects.
            </p>
            <div className="eval-summary">
              <div className="fact">
                <strong>{latest.run.total_cases} deterministic cases</strong>
                <span>Failure modes run through the coordinator.</span>
              </div>
              <div className="fact">
                <strong>Expected outcome checked</strong>
                <span>Each case asserts the safe recovery behavior.</span>
              </div>
              <div className="fact">
                <strong>Persisted evidence</strong>
                <span>Eval results are saved for inspection.</span>
              </div>
            </div>
            <p>
              Started {new Date(latest.run.started_at).toLocaleString()} · readiness{" "}
              {latest.run.failed_cases === 0 ? "READY_FOR_DEMO" : "NOT_READY_FOR_DEMO"}
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Result</th>
                  <th>Checks passed</th>
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
          <p>No reliability eval run has been persisted yet.</p>
        )}
      </section>
    </main>
  );
}
