ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS demo_session_id text;

CREATE INDEX IF NOT EXISTS workflow_runs_demo_session_created_idx
  ON workflow_runs(demo_session_id, created_at DESC);
