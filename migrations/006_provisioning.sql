CREATE TABLE vault_provisions (
 task_id text PRIMARY KEY REFERENCES tasks(id),
 policy_hash text NOT NULL, plan jsonb NOT NULL,
 signature text NOT NULL, wire text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE research_runs DROP CONSTRAINT research_runs_mode_check;
ALTER TABLE research_runs ADD CONSTRAINT research_runs_mode_check CHECK(mode IN ('fixture','local','live'));
