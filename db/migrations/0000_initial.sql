CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS claims (
  id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('OPEN', 'NEGOTIATING', 'CLOSED')),
  claimant_name text NOT NULL,
  loss_type text NOT NULL,
  reserve_amount_cents bigint NOT NULL,
  estimated_loss_cents bigint,
  version integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  network text NOT NULL,
  status text NOT NULL CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  scheduled_for timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('ISSUED', 'VOIDED')),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  body text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enterprise_idempotency_ledger (
  key text PRIMARY KEY,
  action_type text NOT NULL,
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  normalized_input_hash text NOT NULL,
  result_json jsonb NOT NULL,
  claim_version_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fault_profiles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  config_json jsonb NOT NULL,
  is_seeded boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id text,
  replay_of_run_id uuid,
  claim_id text NOT NULL,
  request_text text NOT NULL,
  planner_mode text NOT NULL,
  fault_profile_id text,
  status text NOT NULL,
  actor_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES workflow_runs(id) ON DELETE CASCADE,
  planner_provider text NOT NULL,
  planner_model text,
  source_claim_version integer NOT NULL,
  rationale_summary text NOT NULL,
  raw_provider_response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planned_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  action_type text NOT NULL,
  arguments_json jsonb NOT NULL,
  risk_level text NOT NULL,
  expected_version_at_plan integer NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, ordinal)
);

CREATE TABLE IF NOT EXISTS action_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planned_action_id uuid NOT NULL REFERENCES planned_actions(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  expected_version integer NOT NULL,
  idempotency_key text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  transport_status text NOT NULL,
  http_status integer,
  adapter_operation_id text,
  response_json jsonb,
  error_code text,
  error_message text,
  UNIQUE(planned_action_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS state_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  planned_action_id uuid REFERENCES planned_actions(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES action_attempts(id) ON DELETE CASCADE,
  kind text NOT NULL,
  claim_version integer,
  state_json jsonb NOT NULL,
  read_status text NOT NULL,
  read_error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES action_attempts(id) ON DELETE CASCADE,
  status text NOT NULL,
  desired_effect_json jsonb NOT NULL,
  observed_effect_json jsonb,
  evidence_json jsonb NOT NULL,
  reason_code text NOT NULL,
  reason_summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  planned_action_id uuid NOT NULL REFERENCES planned_actions(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES action_attempts(id) ON DELETE CASCADE,
  decision text NOT NULL,
  reason_code text NOT NULL,
  reason_summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  planned_action_id uuid NOT NULL REFERENCES planned_actions(id) ON DELETE CASCADE,
  status text NOT NULL,
  reason_code text NOT NULL,
  policy_snapshot_json jsonb NOT NULL,
  claim_snapshot_json jsonb NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by_actor_id text,
  decision_note text
);

CREATE TABLE IF NOT EXISTS trace_events (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  planned_action_id uuid REFERENCES planned_actions(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES action_attempts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('INFO', 'WARN', 'ERROR')),
  summary text NOT NULL,
  details_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_version text NOT NULL,
  git_sha text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  total_cases integer NOT NULL,
  passed_cases integer NOT NULL DEFAULT 0,
  failed_cases integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS eval_case_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_run_id uuid NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  case_id text NOT NULL,
  run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  passed boolean NOT NULL,
  assertions_json jsonb NOT NULL,
  failure_summary text,
  duration_ms integer NOT NULL
);

CREATE INDEX IF NOT EXISTS workflow_runs_status_created_idx ON workflow_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS planned_actions_plan_ordinal_idx ON planned_actions(plan_id, ordinal);
CREATE INDEX IF NOT EXISTS action_attempts_action_attempt_idx ON action_attempts(planned_action_id, attempt_number);
CREATE INDEX IF NOT EXISTS trace_events_run_created_idx ON trace_events(run_id, created_at);
CREATE INDEX IF NOT EXISTS review_requests_status_requested_idx ON review_requests(status, requested_at);
CREATE INDEX IF NOT EXISTS claims_id_version_idx ON claims(id, version);
CREATE INDEX IF NOT EXISTS claim_inspections_claim_idx ON claim_inspections(claim_id);
CREATE INDEX IF NOT EXISTS claim_settlements_claim_idx ON claim_settlements(claim_id);
CREATE INDEX IF NOT EXISTS claim_notes_claim_idx ON claim_notes(claim_id);
