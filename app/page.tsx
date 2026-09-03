import { runScenarioAction } from "@/app/actions";
import { scenarios } from "@/lib/fixtures/scenarios";

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
              <span className="badge">{scenario.category}</span>
              <h2>{scenario.title}</h2>
              <p>{scenario.requestText}</p>
            </div>
            <div className="fact">
              <strong>Injected failure</strong>
              <span>{scenario.faultProfileId}</span>
            </div>
            <div className="fact">
              <strong>Expected reliability behavior</strong>
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
