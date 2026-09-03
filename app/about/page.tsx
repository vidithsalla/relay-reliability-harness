export default function AboutPage() {
  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>About Relay</h1>
          <p>Relay is a production-shaped reliability harness for enterprise agent actions.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Purpose</h2>
        <p>
          Relay injects failures around a synthetic system-of-record adapter, reads authoritative state back after attempted
          mutations, reconciles intended versus observed effects, and decides whether to complete, retry safely, replan,
          route to human review, or stop for manual investigation.
        </p>
      </section>
      <section className="panel">
        <h2>What Is Simulated</h2>
        <p>
          The included claims workflow is synthetic and provider-agnostic. This repository does not integrate with Guidewire
          and does not claim to model the target company&apos;s internal systems.
        </p>
      </section>
      <section className="panel">
        <h2>Limitations</h2>
        <p>
          Sequential execution, prototype actors, deterministic recovery rules, fixture-driven local planning, local
          in-process fault injection, and no real payment or settlement side effects.
        </p>
      </section>
    </main>
  );
}
