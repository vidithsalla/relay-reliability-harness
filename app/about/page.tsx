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
        <h2>What Relay Provides</h2>
        <p>
          Relay provides deterministic failure injection, authoritative read-back, reconciliation, idempotency, version
          checks, recovery decisions, human review, replay, and regression evals around agent actions.
        </p>
      </section>
      <section className="panel">
        <h2>Execution Boundary</h2>
        <p>
          The planner proposes intent. Relay owns deterministic execution safety. The enterprise system owns business
          truth. Authorization, version checks, idempotency, reconciliation, retry safety, and recovery decisions stay
          deterministic whether the planner is fixture-driven or backed by xAI/Grok.
        </p>
      </section>
      <section className="panel">
        <h2>Core Reliability Terms</h2>
        <p>
          Failure injection controls where the adapter fails. Reconciliation compares intended state against real system
          state after an attempted action. Idempotency prevents duplicate effects when the same logical request is
          delivered again. Version checks stop stale plans from overwriting newer source-of-record state.
        </p>
      </section>
      <section className="panel">
        <h2>Architecture</h2>
        <pre>{`Natural-language request
  -> PlannerProvider (deterministic | optional Grok)
  -> typed ActionPlan
  -> PlanValidator + RiskPolicy
  -> ExecutionCoordinator
  -> FaultInjectingAdapter
  -> Synthetic ClaimsEnterpriseAdapter
  -> PostgreSQL source of record
  -> post-action read-back
  -> ReconciliationEngine
  -> RecoveryEngine
  -> persisted trace / review / eval evidence`}</pre>
      </section>
      <section className="panel">
        <h2>What Is Simulated</h2>
        <p>
          The included claims workflow is synthetic and provider-agnostic. This repository does not integrate with Guidewire
          and does not claim to model any third-party company&apos;s internal systems.
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
