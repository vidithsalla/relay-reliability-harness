import { runScenarioAction } from "@/app/actions";
import { scenarios } from "@/lib/fixtures/scenarios";
import { titleize } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Relay</h1>
          <p>Stress-test enterprise agent actions against failures that happen after the model says “do it.”</p>
          <p>Synthetic claims workflow. No real insurer or Guidewire integration.</p>
        </div>
      </div>

      <section className="grid" aria-label="Scenario launcher">
        {scenarios.map((scenario) => (
          <article className="card scenario-card" key={scenario.id}>
            <div>
              <span className="badge">{titleize(scenario.category)}</span>
              <h2>{scenario.title}</h2>
              <p>{scenario.requestText}</p>
            </div>
            <div className="fact">
              <strong>Failure being exercised</strong>
              <span>{failureLabel(scenario.faultProfileId, scenario.runMode)}</span>
            </div>
            <div className="fact">
              <strong>Reliability behavior to verify</strong>
              <span>{scenario.expectedBehavior}</span>
            </div>
            <form action={runScenarioAction}>
              <input type="hidden" name="scenarioId" value={scenario.id} />
              <button className="button" type="submit">
                Run scenario
              </button>
            </form>
          </article>
        ))}
      </section>
    </main>
  );
}

function failureLabel(faultProfileId: string, runMode?: string) {
  if (runMode === "duplicate") return "Repeated delivery of the same logical request";
  if (faultProfileId === "none") return "No injected adapter fault";
  if (faultProfileId === "timeout-after-write-reserve") return "Timeout after the reserve write is committed";
  if (faultProfileId === "timeout-before-write-reserve") return "Timeout before the reserve write reaches the system";
  if (faultProfileId === "partial-reserve-success-inspection-timeout-before") {
    return "Reserve commits, then inspection times out before write";
  }
  if (faultProfileId === "stale-version-before-second-action") {
    return "External version change before the second action";
  }
  if (faultProfileId === "ambiguous-write-and-readback-timeout") {
    return "Write timeout followed by failed authoritative read-back";
  }
  if (faultProfileId === "retry-exhaustion-inspection") return "Repeated before-write failures until the retry limit is reached";
  return titleize(faultProfileId);
}
