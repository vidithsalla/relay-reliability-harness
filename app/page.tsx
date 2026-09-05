import { runScenarioAction } from "@/app/actions";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-page compact-home">
      <section className="home-hero compact-hero">
        <div className="home-hero-copy">
          <h1>An AI agent makes a change. The API times out. What happened?</h1>
          <div className="unknown-list" aria-label="Timeout uncertainty">
            <span>Did the change fail?</span>
            <span>Did it succeed but the response got lost?</span>
            <strong>We don&apos;t know yet.</strong>
          </div>
          <p className="home-lede">Relay sits between that failure and the retry.</p>
          <p>
            It checks what actually happened, then decides whether the action should be retried, left alone, replanned,
            or stopped for review.
          </p>
          <p>This prevents blind retries from duplicating, overwriting, or repeating actions that already happened.</p>
          <div className="cta-row">
            <form action={runScenarioAction}>
              <input type="hidden" name="scenarioId" value="timeout-after-write" />
              <button className="button" type="submit">
                See how Relay handles failures
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
          <h2>Example</h2>
          <p>An agent tries to update a reserve from $5,000 to $8,400.</p>
        </div>
        <div className="example-flow" aria-label="Timeout after write example">
          <ExampleStep number="1" label="Agent sends the update" value="Reserve -> $8,400" />
          <ExampleStep number="2" label="API times out" value="No success response comes back" status="warning" />
          <ExampleStep
            number="3"
            label="Relay checks the actual system"
            value="Reserve is already $8,400"
            status="success"
          />
          <ExampleStep number="4" label="Relay decides" value="Do not retry" status="success" />
        </div>
        <p className="closing-line">
          The request looked like it failed. The business action actually succeeded. Relay caught the difference.
        </p>
      </section>

      <section className="home-section how-section">
        <div className="section-heading">
          <h2>How it works</h2>
        </div>
        <div className="how-flow" aria-label="How Relay works">
          <HowStep title="Agent tries an action" text="Relay records what was supposed to happen." />
          <HowStep title="The enterprise call runs" text="It may succeed, fail, time out, or only partially complete." />
          <HowStep title="Relay checks the real system state" text="It does not trust the API response by itself." />
          <HowStep title="Relay compares intent with reality" text="What should have happened vs. what actually happened." />
          <HowStep title="Relay chooses the safe next step" text="Retry, leave it alone, replan, or stop for a person." />
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
            text="The change happens, but the response is lost."
          />
          <FeaturedScenario
            scenarioId="partial-completion"
            title="Partial completion"
            text="One action succeeds, the next fails."
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

function ExampleStep(props: { number: string; label: string; value: string; status?: "success" | "warning" }) {
  return (
    <div className={props.status ? `flow-row ${props.status}` : "flow-row"}>
      <span>{props.number}</span>
      <div>
        <b>{props.label}</b>
        <strong>{props.value}</strong>
      </div>
    </div>
  );
}

function HowStep(props: { title: string; text: string }) {
  return (
    <div className="how-step">
      <h3>{props.title}</h3>
      <p>{props.text}</p>
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
