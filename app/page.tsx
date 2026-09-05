import { runScenarioAction } from "@/app/actions";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-page compact-home">
      <section className="home-hero compact-hero">
        <div className="home-hero-copy">
          <h1>Relay</h1>
          <p className="home-lede">
            An AI agent makes a change. The API times out. Did the change fail, or did it succeed and only the
            response get lost?
          </p>
          <p>Relay checks what actually happened before the agent retries.</p>
          <p>A blind retry can duplicate payments, overwrite newer data, or repeat actions that already succeeded.</p>
          <div className="cta-row">
            <form action={runScenarioAction}>
              <input type="hidden" name="scenarioId" value="timeout-after-write" />
              <button className="button" type="submit">
                See timeout after write
              </button>
            </form>
            <Link className="button secondary" href="/scenarios">
              Explore all scenarios
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section example-section">
        <div className="section-heading">
          <h2>Why Relay exists</h2>
        </div>
        <div className="example-flow" aria-label="Timeout after write example">
          <FlowStep label="Agent asks" value="Set claim reserve to $8,400" />
          <FlowStep label="API response" value="TIMEOUT" status="warning" />
          <FlowStep label="Actual system" value="Reserve is already $8,400" status="success" />
          <FlowStep label="Relay decision" value="Do not retry" status="success" />
        </div>
        <p className="closing-line">The API said &apos;timeout.&apos; The business action still succeeded.</p>
        <p className="example-support">Relay checks the system of record before deciding what happens next.</p>
      </section>

      <section className="home-section rule-section">
        <div className="section-heading">
          <h2>What Relay decides after every action</h2>
          <p>Relay decides from the actual system state, not the API response alone.</p>
        </div>
        <div className="outcome-strip" aria-label="Relay recovery outcomes">
          <Outcome label="It already happened" value="Don't do it again" tone="success" />
          <Outcome label="It definitely didn't happen" value="Retry safely" tone="warning" />
          <Outcome label="We can't prove either" value="Stop and investigate" tone="manual" />
        </div>
      </section>

      <section className="home-section explore-section compact-explore">
        <div className="section-heading">
          <h2>Try the failure modes</h2>
        </div>
        <div className="featured-scenarios compact-scenarios">
          <FeaturedScenario
            scenarioId="timeout-after-write"
            title="Timeout after write"
            text="The write succeeds, but the response is lost."
          />
          <FeaturedScenario
            scenarioId="partial-completion"
            title="Partial completion"
            text="One action succeeds, the next one fails."
          />
          <FeaturedScenario
            scenarioId="ambiguous-outcome"
            title="Ambiguous outcome"
            text="Relay cannot prove whether the action happened."
          />
        </div>
        <div className="final-cta">
          <Link className="button" href="/scenarios">
            Explore all scenarios
          </Link>
          <p>Synthetic claims workflow. No real insurer or Guidewire integration.</p>
        </div>
      </section>
    </main>
  );
}

function FlowStep(props: { label: string; value: string; status?: "success" | "warning" }) {
  return (
    <div className={props.status ? `flow-row ${props.status}` : "flow-row"}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function Outcome(props: { label: string; value: string; tone: "success" | "warning" | "manual" }) {
  return (
    <div className={`outcome ${props.tone}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function FeaturedScenario(props: { scenarioId: string; title: string; text: string }) {
  return (
    <article className="scenario-link-card">
      <div>
        <h3>{props.title}</h3>
        <p>{props.text}</p>
      </div>
      <form action={runScenarioAction}>
        <input type="hidden" name="scenarioId" value={props.scenarioId} />
        <button className="text-button" type="submit">
          Run
        </button>
      </form>
    </article>
  );
}
