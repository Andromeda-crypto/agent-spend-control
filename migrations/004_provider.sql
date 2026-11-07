CREATE TABLE provider_receipts (
 dispatch_id text PRIMARY KEY, provider text NOT NULL, outcome jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vault_bindings (
 task_id text PRIMARY KEY REFERENCES tasks(id), program_id text NOT NULL, policy_address text NOT NULL UNIQUE,
 vault_address text NOT NULL, mint text NOT NULL, recipient_account text NOT NULL,
 owner_address text NOT NULL, agent_address text NOT NULL, chain_version integer NOT NULL,
 cluster text NOT NULL CHECK(cluster IN ('localnet','devnet'))
);
ALTER TABLE requests ADD COLUMN last_checked_at timestamptz NOT NULL DEFAULT now();
