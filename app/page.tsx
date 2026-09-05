import { runScenarioAction } from "@/app/actions";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-page compact-home">
      <section className="home-hero compact-hero">
        <div className="home-hero-copy">
          <h1>An AI agent makes a change. The API times out. What happened?</h1>
          <p className="home-lede">Did it fail, succeed without returning a response, or leave us unable to tell?</p>
          <p className="home-lede">Relay sits between that failure and the retry.</p>
          <p>It checks what actually happened before deciding what should happen next.</p>
          <p>That prevents blind retries from duplicating, overwriting, or repeating actions.</p>
          <div className="cta-row">
            <form action={runScenarioAction}>
              <input type="hidden" name="scenarioId" value="timeout-after-write" />
              <button className="button" type="submit">
                See how Relay handles failures
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="home-section explainer-section">
        <div className="section-heading">
          <h2>How Relay works</h2>
          <p>
            An agent tries to update a claim reserve from $5,000 to $8,400. The timeout is real, but it is not enough
            to know whether the business change happened.
          </p>
        </div>

        <div className="relay-gap-explainer" aria-label="Relay timeout after write explanation">
          <div className="gap-stack">
            <ExplainerNode label="Agent intent" value="Reserve $5,000 -> $8,400" />
            <ExplainerNode label="Enterprise call" value="API timeout" note="No success response comes back." tone="warning" />
          </div>

          <div className="gap-middle">
            <div className="uncertainty-node">
              <span>The uncertainty gap</span>
              <strong>Did the change happen?</strong>
              <p>The response cannot tell us.</p>
            </div>
            <div className="relay-node">
              <span>Relay</span>
              <strong>Checks what actually happened</strong>
            </div>
          </div>

          <div className="gap-stack">
            <ExplainerNode label="Actual system" value="Reserve = $8,400" tone="success" />
            <ExplainerNode label="Safe decision" value="Do not retry" note="The effect already exists." tone="success" />
          </div>
        </div>
        <p className="closing-line">
          The request looked like it failed. The business action actually succeeded. Relay caught the difference before
          another write could run.
        </p>
      </section>

      <section className="home-section bridge-section">
        <p>
          The same pattern lets Relay handle partial completion, stale state, duplicate requests, and outcomes that
          cannot be safely proven.
        </p>
      </section>

      <section className="home-section explore-section compact-explore">
        <div className="section-heading">
          <h2>Try the failure modes</h2>
        </div>
        <div className="featured-scenarios compact-scenarios">
          <FeaturedScenario
            scenarioId="timeout-after-write"
            title="Timeout after write"
            text="The change succeeds, but the response is lost."
          />
          <FeaturedScenario
            scenarioId="partial-completion"
            title="Partial completion"
            text="One action succeeds and the next fails."
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

function ExplainerNode(props: { label: string; value: string; note?: string; tone?: "success" | "warning" }) {
  return (
    <div className={props.tone ? `explainer-node ${props.tone}` : "explainer-node"}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.note ? <p>{props.note}</p> : null}
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
