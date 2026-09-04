import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">Agent execution reliability</span>
          <h1>Relay</h1>
          <p className="home-lede">
            AI agents can call enterprise APIs. The harder problem is knowing what actually happened afterward.
          </p>
          <p>
            An API can time out after a write succeeds. A workflow can complete halfway. The data an agent planned
            against can change before execution. Blindly retrying can duplicate or corrupt real business actions.
          </p>
          <p>
            Relay checks the actual system of record after agent actions, reconciles what the agent intended with what
            really happened, and decides whether it is safe to complete, retry, replan, or hand control to a person.
          </p>
          <div className="cta-row">
            <Link className="button" href="/scenarios">
              Explore failure scenarios
            </Link>
            <Link className="button secondary" href="#how-relay-works">
              How Relay works
            </Link>
          </div>
        </div>
        <div className="hero-proof" aria-label="Timeout after write summary">
          <span className="eyebrow">Centerpiece failure</span>
          <strong>Timeout after write</strong>
          <p>The response disappears after the source of record accepts the mutation.</p>
          <div className="mini-proof">
            <span>API says timeout</span>
            <span>Record says applied</span>
            <span>Relay says do not retry</span>
          </div>
        </div>
      </section>

      <section className="home-section problem-section">
        <div className="section-heading">
          <span className="eyebrow">One concrete problem</span>
          <h2>The problem in 15 seconds</h2>
        </div>
        <div className="problem-layout">
          <div className="reserve-snapshot" aria-label="Reserve change example">
            <div>
              <span>Before</span>
              <strong>$5,000</strong>
            </div>
            <div>
              <span>Intended</span>
              <strong>$8,400</strong>
            </div>
            <div>
              <span>API returns</span>
              <strong>TIMEOUT</strong>
            </div>
          </div>
          <div className="problem-answer">
            <h3>Did the write fail?</h3>
            <strong>Not necessarily.</strong>
            <p>
              The database may have accepted the change and only the response was lost. If the agent blindly retries, a
              consequential action could happen twice.
            </p>
          </div>
          <div className="simple-flow" aria-label="Timeout uncertainty flow">
            <FlowStep label="Agent intent" value="Reserve -> $8,400" />
            <FlowStep label="API result" value="Timeout" />
            <FlowStep label="Real business state" value="Unknown until checked" />
            <FlowStep label="Blind retry?" value="Potentially dangerous" />
          </div>
        </div>
      </section>

      <section className="home-section" id="how-relay-works">
        <div className="section-heading">
          <span className="eyebrow">Relay&apos;s answer</span>
          <h2>Relay checks reality before deciding what to do next.</h2>
        </div>
        <ol className="lifecycle">
          <li>Agent proposes action</li>
          <li>Enterprise call is attempted</li>
          <li>Relay reads authoritative state</li>
          <li>Relay compares intent with observed reality</li>
          <li>Relay selects the safe recovery path</li>
        </ol>
        <div className="truth-statement">
          Relay treats the system of record, not the API response or planner output, as business truth.
        </div>
        <div className="answer-grid" aria-label="Timeout after write proof">
          <ProofFact label="Intended state" value="Reserve = $8,400" />
          <ProofFact label="API result" value="Timeout" />
          <ProofFact label="Observed state" value="Reserve = $8,400" />
          <ProofFact label="Reconciled state" value="Confirmed Applied" />
          <ProofFact label="Recovery" value="Do not retry" />
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <span className="eyebrow">Generalizes beyond one timeout</span>
          <h2>Failures are rarely just success or failure.</h2>
        </div>
        <div className="failure-list">
          <FailureExample
            title="Partial execution"
            problem="One action succeeds and the next fails."
            answer="Relay preserves the completed effect and retries only what is proven missing."
          />
          <FailureExample
            title="Stale state"
            problem="The source record changes after the agent planned its action."
            answer="Relay stops instead of overwriting newer state and requires replanning."
          />
          <FailureExample
            title="Ambiguous outcome"
            problem="A potentially irreversible action times out and authoritative read-back also fails."
            answer="Relay refuses to guess or blindly retry and routes the run for investigation."
          />
        </div>
      </section>

      <section className="home-section two-column">
        <div>
          <span className="eyebrow">Definition</span>
          <h2>What Relay is</h2>
          <p className="home-lede">Relay is a reliability harness for AI agents that perform enterprise mutations.</p>
        </div>
        <div>
          <p>
            It provides deterministic failure injection, authoritative read-back, reconciliation, idempotency, version
            checks, recovery decisions, human review, replay, and regression evals around agent actions.
          </p>
          <p>
            The included insurance claims workflow is synthetic. It is a test environment for the reliability layer, not
            an insurance product or Guidewire integration.
          </p>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <span className="eyebrow">Trust boundary</span>
          <h2>Where AI stops and deterministic software begins</h2>
        </div>
        <div className="trust-boundary" aria-label="AI Relay enterprise system trust boundary">
          <BoundaryStep title="AI" text="Understands what should happen" />
          <BoundaryStep title="Relay" text="Owns correctness around execution" />
          <BoundaryStep title="Enterprise system" text="Owns authoritative business state" />
        </div>
        <p className="boundary-rule">
          The model proposes intent. Deterministic software owns execution safety. The enterprise system owns truth.
        </p>
        <p>
          The planner may be deterministic or xAI/Grok-backed. Authorization, version checks, idempotency,
          reconciliation, retry safety, and recovery are deterministic.
        </p>
      </section>

      <section className="home-section explore-section">
        <div>
          <span className="eyebrow">Explore</span>
          <h2>Break it yourself</h2>
          <p>
            Relay includes controlled scenarios for failure modes that appear once agents start changing real systems.
          </p>
        </div>
        <div className="featured-scenarios">
          <ProofFact label="Timeout after write" value="The write succeeds but the response is lost." />
          <ProofFact label="Partial completion" value="One action succeeds and the next fails." />
          <ProofFact label="Ambiguous outcome" value="Neither success nor failure can be safely proven." />
        </div>
        <Link className="button" href="/scenarios">
          Explore all scenarios
        </Link>
      </section>
    </main>
  );
}

function FlowStep(props: { label: string; value: string }) {
  return (
    <div className="flow-step">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function ProofFact(props: { label: string; value: string }) {
  return (
    <div className="proof-fact">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function FailureExample(props: { title: string; problem: string; answer: string }) {
  return (
    <article className="failure-example">
      <h3>{props.title}</h3>
      <p>{props.problem}</p>
      <strong>{props.answer}</strong>
    </article>
  );
}

function BoundaryStep(props: { title: string; text: string }) {
  return (
    <div className="boundary-step">
      <strong>{props.title}</strong>
      <span>{props.text}</span>
    </div>
  );
}
