# Status — 2026-11-06

## Baseline
Repository initially contained only a 21-byte README and an initial commit.
No starter, tests, policy evaluator or demo existed. Work is isolated on
feat/durable-request-lifecycle. Node 26.12.1 and npm 11.20.0 are installed.
Docker, PostgreSQL CLI, Rust, Solana CLI and Anchor were not found on PATH.

## Implemented
Stage 0 foundation: pinned dependencies/lockfile, TypeScript configuration,
CI checks, local database service, setup and architecture documentation.
Stage 1 partial: strict policy/purchase schemas; hashed scoped task agent
credentials and separate owner credentials; HTTP submission and approval;
PostgreSQL task-row locking and reservation counters; payload-bound
idempotency; version-bound approval and dispatch; owner pause/revoke;
durable requests/events and conservative dispatched-state retention.
Stage 2 preparation: official-source compatibility investigation and local
program test plan in STAGE2.md. No compatibility claim or deployment.

## Verification
TypeScript check passed. Embedded PostgreSQL lifecycle tests cover payload
conflicts, hard caps, exact approvals, owner/agent separation, recipient
allowlists, double dispatch and retention of uncertain reservations.
Dependency installation audit after upgrading Zod to 4.6.7: zero vulnerabilities.
Embedded tests do not establish multi-connection PostgreSQL concurrency safety.
No live PostgreSQL, container, HTTP smoke test, Devnet or provider execution
has been verified. Initial tsx CLI test invocation failed because the sandbox
blocks its IPC socket; scripts use Node's tsx loader directly instead.

## Remaining and exact next action
Stage 0 is incomplete: fresh-clone installation and terminal demo still need
verification. Stage 1 is incomplete: multi-connection PostgreSQL race/restart
integration tests, workspace reuse, explicit agent records, policy editing,
HTTP read/list schemas, usage ledger, approval history, worker/provider
reconciliation and SDK are outstanding. No real adapters or worker exist.
Bootstrap owner credentials are developer-managed, not a full login system.

Next: obtain a PostgreSQL 17 instance (or install Docker), run migrations,
then test two concurrent transactions reserving against one task. Assert only
one can reserve the final allowance, changed-payload retries fail, and pending
rows survive a fresh gateway process. Add durable usage and independent
worker dispatch/reconciliation before exposing any real provider execution.
Then install/pin the Solana toolchain and implement local vault tests.

No secrets, wallet files, domain purchase, paid services or real funds used.
