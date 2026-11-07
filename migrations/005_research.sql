CREATE TABLE research_runs (
 id text PRIMARY KEY, task_id text NOT NULL REFERENCES tasks(id), topic text NOT NULL,
 mode text NOT NULL CHECK(mode IN ('fixture','live')), step integer NOT NULL DEFAULT 0,
 state text NOT NULL DEFAULT 'running' CHECK(state IN ('running','awaiting_approval','complete','stopped')),
 request_id text REFERENCES requests(id), report text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE chain_attempts (
 dispatch_id text PRIMARY KEY, task_id text NOT NULL REFERENCES tasks(id),
 purchase_id text NOT NULL, scope text NOT NULL, signature text NOT NULL, wire text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chain_approvals (request_id text PRIMARY KEY REFERENCES requests(id), exception_address text NOT NULL);
ALTER TABLE vault_bindings ADD COLUMN revoked boolean NOT NULL DEFAULT false;
