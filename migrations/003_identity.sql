CREATE TABLE owners (
 id text PRIMARY KEY, workspace_id text NOT NULL UNIQUE REFERENCES workspaces(id),
 name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE agents (
 id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id),
 task_id text NOT NULL UNIQUE REFERENCES tasks(id), name text NOT NULL,
 revoked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE credentials (
 token_hash text PRIMARY KEY, owner_id text REFERENCES owners(id), agent_id text REFERENCES agents(id),
 revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((owner_id IS NULL) <> (agent_id IS NULL))
);
INSERT INTO owners(id,workspace_id,name) SELECT id,id,'Workspace owner' FROM workspaces;
INSERT INTO agents(id,workspace_id,task_id,name) SELECT id,workspace_id,id,'Task agent' FROM tasks;
INSERT INTO credentials(token_hash,owner_id) SELECT owner_hash,id FROM workspaces;
INSERT INTO credentials(token_hash,agent_id) SELECT agent_hash,id FROM tasks;
CREATE TABLE identity_events (
 id bigserial PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id),
 action text NOT NULL, subject_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
