ALTER TABLE requests ADD COLUMN IF NOT EXISTS dispatch_id text UNIQUE;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS adapter_version text;
CREATE TABLE IF NOT EXISTS approvals (
  request_id text PRIMARY KEY REFERENCES requests(id),
  workspace_id text NOT NULL REFERENCES workspaces(id),
  policy_version integer NOT NULL,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS usage (
  request_id text PRIMARY KEY REFERENCES requests(id),
  task_id text NOT NULL REFERENCES tasks(id),
  reserved_amount bigint NOT NULL CHECK (reserved_amount >= 0),
  charged_amount bigint NOT NULL CHECK (charged_amount >= 0 AND charged_amount <= reserved_amount),
  calls integer NOT NULL CHECK (calls IN (0,1)),
  delivery text NOT NULL CHECK (delivery IN ('delivered','failed')),
  receipt jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
-- This models a self-operated FIXTURE provider, never a real payment service.
CREATE TABLE IF NOT EXISTS fixture_receipts (
  dispatch_id text PRIMARY KEY,
  payload_hash text NOT NULL,
  outcome jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_work ON requests(state, created_at, id);
ALTER TABLE tasks ADD CONSTRAINT calls_used_nonnegative CHECK (calls_used >= 0);
ALTER TABLE tasks ADD CONSTRAINT calls_reserved_nonnegative CHECK (calls_reserved >= 0);
