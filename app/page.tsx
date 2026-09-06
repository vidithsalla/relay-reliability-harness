import { runScenarioAction } from "@/app/actions";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-page compact-home">
      <section className="home-hero compact-hero">
        <div className="home-hero-copy">
          <h1>An AI agent makes a change. The API times out. What actually happened?</h1>
          <p className="home-lede">Did it fail, succeed without returning a response, or leave us unable to tell?</p>
          <p className="home-lede">Relay sits between that failure and the retry.</p>
          <p>It checks what actually happened before deciding what should happen next.</p>
          <p>That prevents blind retries from duplicating, overwriting, or repeating actions.</p>
          <div className="cta-row">
            <a className="button" href="#proof">
              See how Relay handles failures
            </a>
            <Link className="hero-text-link" href="/scenarios">
              Explore all scenarios
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section explainer-section" id="how-relay-works">
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

      <section className="home-section proof-section" id="proof" aria-labelledby="proof-heading">
        <div className="section-heading">
          <h2 id="proof-heading">See the proof</h2>
          <p>Run the failure, inspect an execution trace, or check the reliability evals.</p>
        </div>
        <div className="proof-gateway">
          <form action={runScenarioAction} className="proof-form">
            <input type="hidden" name="scenarioId" value="timeout-after-write" />
            <button className="proof-entry" type="submit">
              <ProofPreview
                items={[
                  ["API", "Timeout", "warning"],
                  ["Observed", "$8,400", "success"],
                  ["Decision", "Do not retry", "success"]
                ]}
              />
              <span className="proof-label">Run a failure</span>
              <span className="proof-copy">Trigger timeout-after-write and watch Relay prevent a duplicate retry.</span>
            </button>
          </form>
          <Link className="proof-entry" href="/runs">
            <div className="mini-timeline" aria-hidden="true">
              <span>Attempt</span>
              <span>Timeout</span>
              <span>Read-back</span>
              <span>Confirmed Applied</span>
              <span>Complete</span>
            </div>
            <span className="proof-label">Inspect a trace</span>
            <span className="proof-copy">Open Execution Traces to see the attempted action, read-back, reconciliation, and recovery decision.</span>
          </Link>
          <Link className="proof-entry" href="/evals">
            <div className="eval-preview" aria-hidden="true">
              <span>Eval suite</span>
              <strong>12 / 12</strong>
              <span>deterministic cases</span>
            </div>
            <span className="proof-label">View the evals</span>
            <span className="proof-copy">Open Reliability Evals to inspect the deterministic regression suite covering the failure semantics.</span>
          </Link>
        </div>
      </section>

      <section className="home-section hood-section" aria-labelledby="hood-heading">
        <div className="section-heading">
          <h2 id="hood-heading">Under the hood</h2>
          <p>The planner proposes intent. Deterministic software owns execution safety.</p>
        </div>
        <div className="hood-grid">
          <HoodItem
            title="Failure injection"
            text="Reproduces timeout-before-write, timeout-after-write, partial completion, stale state, and other failure conditions deterministically."
            href="/scenarios"
            linkText="See scenarios"
          />
          <HoodItem
            title="Reconciliation + recovery"
            text="Compares intended effects with the resulting system state before deciding whether to leave an action alone, retry selectively, replan, or stop."
            href="/runs"
            linkText="Inspect a trace"
          />
          <HoodItem
            title="Execution safety"
            text="Uses idempotency, expected-version checks, retry limits, selective retry, and human review to prevent unsafe repeated mutations."
            href="/scenarios"
            linkText="See failure cases"
          />
          <HoodItem
            title="Verification"
            text="Persists execution evidence in Postgres and exercises the reliability semantics through replayable traces, integration tests, browser workflows, and deterministic evals."
            href="/evals"
            linkText="View evals"
          />
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

function ProofPreview(props: { items: Array<[string, string, "warning" | "success"]> }) {
  return (
    <div className="proof-preview" aria-hidden="true">
      {props.items.map(([label, value, tone]) => (
        <span className={tone} key={label}>
          <b>{label}</b>
          <strong>{value}</strong>
        </span>
      ))}
    </div>
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

function HoodItem(props: { title: string; text: string; href: string; linkText: string }) {
  return (
    <article className="hood-item">
      <h3>{props.title}</h3>
      <p>{props.text}</p>
      <Link href={props.href}>{props.linkText}</Link>
    </article>
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
