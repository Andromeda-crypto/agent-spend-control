# Agent Spending Control

Delegate bounded resources to agents, approve exceptions, revoke access, and
inspect itemized usage. Current checkpoint: working fixture dashboard and durable
research workflow, explicit identities and credential rotation, and a Solana
vault verified with actual local-validator transactions.

**Live integration is unfinished.** There is no Devnet deployment or verified
end-to-end OpenAI + paid-service run yet. See [STATUS.md](docs/STATUS.md) for the
resume checklist. No billable OpenAI calls are authorized at this checkpoint.

## Checks and fixture terminal demo

Requires Node >=22.12 (CI targets 24; local verification used 26).

```sh
npm ci
npm run check
npm test
npm run demo
npm run web:build
```

The terminal demo uses an embedded database and explicitly synthetic charges.
It requires no provider credentials, Solana wallet or funds.

## Dashboard and durable fixture workflow

Requires PostgreSQL 17. Start the supplied Compose database or use an existing
local instance. Copy `.env.example` to the ignored `.env.local`; the gateway,
migration and worker commands load it automatically. Keep live execution disabled.

```sh
docker compose up -d
npm run migrate
npm run dev
```

In separate terminals:

```sh
npm run worker:watch
npm run web:dev
```

Open **http://127.0.0.1:5173**. Create a workspace and save its owner key, then
create a research task. The four-step fixture workflow pauses at the 40-unit
premium dataset request. Approve it to resume and produce a synthetic report.
The dashboard supports task totals, approval, timeline, receipts, export,
pause/resume/revoke, structured policy edits and credential rotation.

Owner-key sign-in is a developer bootstrap, not email/SSO authentication. Owner
keys are retained in browser session storage; agent keys are shown once. Do not
put owner keys in agent context. New dashboard tasks are fixture-only; live
vault provisioning/onboarding remains unfinished.

`npm run worker:once` executes a single bounded pass. Watch mode repeats passes
serially. The agent worker never loads the owner wallet. The separate
`npm run owner:once` command synchronizes owner-authorized on-chain exceptions
and revocations only when live execution is explicitly enabled and configured.
This separation is an application boundary, not an OS sandbox for wallet files.

## Real PostgreSQL tests

```sh
# PostgreSQL binaries on PATH:
npm run test:postgres
# macOS Homebrew alternative:
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run test:postgres
```

This creates, tests, stops and removes a temporary localhost cluster. The tests
include races, rollback, restart persistence, tenant isolation, rotation, and a
DOM-driven dashboard → HTTP → database → fixture worker → approval → report flow.
For an existing **disposable** test database:

```sh
TEST_DATABASE_URL=postgres://spend:local-only@localhost:5432/spend_test \
  node --import tsx --test 'test/postgres/*.test.ts'
```

## Local Solana vault

Requires Rust and Solana CLI. This checkpoint used Anchor crates 0.32.1, Solana
CLI 2.3.0, and SBF platform tools v1.58; Cargo.lock pins transitive dependencies.
Anchor CLI itself is not required for the checked-in build/test commands.

```sh
cargo test --locked -p spending-vault --lib
npm run vault:build
npm run test:solana
```

Set `SOLANA_BIN` when the CLI is outside the standard Solana install directory.
The build helper downloads pinned SBF tools if absent. Local tests start an
isolated validator, load the compiled program, exercise actual test-token
transfers and restrictions, then remove the temporary ledger.

The local genesis-loaded program has upgrades disabled. No Devnet upgrade
authority exists yet because deployment has not succeeded. Devnet deployment
must use the matching local program keypair, disclose its chosen upgrade
authority, and record explorer links. Keypairs, ledgers, build output and env
files are ignored by Git.

See [HTTP/SDK integration](docs/API.md), [architecture](docs/ARCHITECTURE.md),
[Solana notes](docs/STAGE2.md), and [resume status](docs/STATUS.md).
