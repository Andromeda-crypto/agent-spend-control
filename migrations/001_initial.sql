CREATE TABLE IF NOT EXISTS workspaces (id text PRIMARY KEY, owner_hash text NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS tasks (
 id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id),
 agent_hash text NOT NULL UNIQUE, policy jsonb NOT NULL, version integer NOT NULL DEFAULT 1,
 spent bigint NOT NULL DEFAULT 0 CHECK(spent>=0), reserved bigint NOT NULL DEFAULT 0 CHECK(reserved>=0),
 calls_used integer NOT NULL DEFAULT 0, calls_reserved integer NOT NULL DEFAULT 0,
 paused boolean NOT NULL DEFAULT false, revoked boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS requests (
 id text PRIMARY KEY, task_id text NOT NULL REFERENCES tasks(id), key text NOT NULL,
 payload jsonb NOT NULL, version integer NOT NULL, state text NOT NULL CHECK(state IN ('approval','reserved','dispatched','succeeded','failed','cancelled')),
 approved_by text REFERENCES workspaces(id), receipt jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(task_id,key)
);
CREATE TABLE IF NOT EXISTS events (
 id bigserial PRIMARY KEY, request_id text NOT NULL REFERENCES requests(id),
 state text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
