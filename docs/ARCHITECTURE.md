# Architecture and recovery

- `packages/policy`: strict purchase/policy schemas and deterministic rules.
- `apps/gateway`: Node HTTP API, transactional repository, migrations.
- `apps/worker`: bounded dispatch and reconciliation passes.
- `packages/adapters`: portable adapter contract and self-operated fixture.
- `packages/sdk`: HTTP client and explicit response schemas.
- `scripts/demo.ts`: embedded-database terminal demonstration.

## Transaction boundaries and authority

Every production lifecycle operation runs through `transaction(pool, callback)`.
It checks out one connection, starts a READ COMMITTED transaction, takes the
task row lock before request locks, and commits or rolls back before releasing
the connection. Do not instantiate Store on an untransactioned connection.
The explicit locking model follows PostgreSQL's guidance for application
consistency; node-postgres requires one checked-out client per transaction:

- https://www.postgresql.org/docs/17/applevel-consistency.html
- https://www.postgresql.org/docs/17/explicit-locking.html
- https://node-postgres.com/features/transactions

The task row serializes budget/quota allocation, owner decisions, and final
accounting. Budget and call reservations include all reserved/dispatched work.
Approval revalidates hard limits rather than bypassing them. The immutable
approval record binds owner workspace, policy version and canonical payload
hash. Dispatch rechecks that binding, current policy, expiry, pause/revocation,
allowlists and the trusted adapter quote. Policy edits require the owner and
an expected version; pending work is cancelled rather than silently authorized
under a different version. Existing dispatched work retains its reservation.

Owner credentials are independent of task-scoped agent credentials. Credentials
are SHA-256 hashes of high-entropy bearer tokens. Responses never include these
hashes. Reusing an owner token reuses the workspace. Interactive login, owner
credential rotation, explicit agent registry and resource-level database roles
remain future work. Database access is privileged infrastructure authority.
There are no HTTP dispatch, completion or arbitrary-proxy endpoints.

## Execution and reconciliation

The worker scans up to 100 reserved and 100 dispatched requests per pass.
Concurrent workers serialize each claim using task/request locks. A fresh
unique dispatch ID and adapter version are committed before any external work.
The provider call happens outside the transaction. Quotes must be synchronous,
local, reliable upper bounds; real adapters must document how they obtain them.

Approval -> reserved -> dispatched -> succeeded/failed.
Approval/reserved -> cancelled on owner pause/revoke or policy replacement.
Dispatch also cancels expired, invalid, missing-adapter or mismatched-quote work.
A request cannot be dispatched twice.

Dispatched work is never automatically sent again. A subsequent pass uses the
original adapter version's read-only lookup with the persisted dispatch ID.
Exceptions, timeouts, absent receipts and malformed/over-budget evidence retain
the reservation. Confirmed evidence atomically releases it, updates counters,
writes a unique per-request usage row, and records the terminal event. Duplicate
identical settlement is harmless; conflicting settlement fails.

The ledger distinguishes confirmed charged amount, actual consumed calls,
delivery status and receipt. A failed delivery may still have a charge. Unused
reserved units are released only on confirmed settlement. Revoking a task
cannot undo already-dispatched billable work. A missing original adapter leaves
work pending rather than guessing its outcome.

The fixture adapter stores its synthetic provider receipts independently from
the request transaction, keyed by dispatch ID and payload hash. This is a test
model of a provider's idempotency/lookup interface, not evidence that real
providers offer those guarantees. All receipts identify fixture data.

## Migrations and recovery

`npm run migrate` applies ordered migrations in a transaction, serializes runners
with an advisory lock, and records checksums. Editing an applied migration fails.
The previous checkpoint's unversioned schema can be adopted by running the new
runner. Never edit 001/002 once deployed; add another migration.

Back up PostgreSQL with pg_dump and restore into a separate database using
pg_restore before switching traffic. Backup/restore has not yet been exercised.
Run migrations before starting new code. A gateway restart does not clear rows.
After a crash, run the worker to reconcile dispatched receipts; reserved work
can be claimed normally. Do not delete the Compose volume for recovery.

A crash between committing dispatch and contacting the provider leaves an
uncertain request. If lookup cannot prove an outcome, leave it pending for
manual investigation; never infer failure or retry a payment. Legacy dispatched
rows without a dispatch ID/version likewise require manual investigation.

## Remaining operational work

The worker is a one-pass command, not a scheduler. Old unresolved requests may
occupy the bounded reconciliation batch; fair retry scheduling/backoff and
operator tooling are still needed. Provider-specific signatures, finality,
real usage reconciliation, production rate limiting, retention/pagination,
credential rotation and deployment checks remain outstanding. No production
readiness or real-provider monetary-cap claim is made.

## Current checkpoint additions (2026-11-06)

Migrations 003–005 add explicit owners, task agents, revocable credentials,
identity events, provider receipts, vault bindings, chain attempts and durable
reference research runs. Existing owner/agent hashes are backfilled into the
new credential records. Authentication now checks active scoped credentials.
Owner rotation is single-use under concurrency and old tokens remain revoked.

The reference workflow uses trusted stored task identity and fixed step types;
model output cannot approve purchases or modify authority. The internal
reserveTrusted path is never exposed as a public unauthenticated submission.
The agent worker uses only the restricted agent signer. Owner wallet loading
is confined to the separate owner operator command. Signed chain attempts are
persisted before submission; uncertain attempts are reconciled without creating
another payment. Finalized receipts are required for Devnet delivery, while
local tests use confirmed receipts.

The earlier operational notes describe the previous checkpoint. Watch mode,
oldest-checked-first polling, identity records/rotation and a fixture dashboard
now exist. Pagination, production login, scheduler supervision, operator
recovery tools and real-provider end-to-end verification remain outstanding.

The SPA is a static Vite application, portable to static hosting. Development
uses a same-origin /api proxy to the gateway. Production hosting and routing
are not configured yet. DOM+HTTP tests verify its fixture workflow; visual,
mobile and real-browser QA still need to be performed.

## Provisioning and test-cluster integration

Migration 006 adds persisted atomic provisioning plans and local research mode;
007 adds explicitly labeled Devnet-demo mode. A workspace owner token plus a
wallet signature authorizes a binding. The expected policy PDA includes the
hashed task ID and owner. The gateway independently verifies cluster genesis,
program-owned policy, exact limits/version/expiry, supported mint, recipient,
restricted agent, PDA token authority, decimals and funded balance. No network
calls occur inside the task-lock transaction. A second authorization/version
check closes the gap between chain inspection and database commit.

Vault creation and deposit share one Solana transaction. The application persists
that signed transaction before sending; retries reuse it, so neither an uncertain
response nor a crash can trigger a second deposit. A failed/expired provisioning
attempt is retained for operator review. Policy changes are forbidden once a
provisioning plan or vault binding exists. Existing verified bindings are immutable
and can be retrieved idempotently after spending.

The combined integration runner provisions temporary PostgreSQL and a validator,
then exercises the actual HTTP dashboard, program, paid service, ledger and owner
signer. It covers forged/cross-tenant bindings, unpaid/copied service proofs,
ambiguous submission, exact approval synchronization, charged-but-failed delivery,
repeated provisioning, finalized-state observation and revoked dispatch recovery.
The simulated model is explicitly labeled and never calls OpenAI.

The full-cluster check compares complete genesis hashes, not 32-character CAIP-2
references. The known values were checked against the official SDK and Devnet CLI:
https://github.com/solana-labs/solana/blob/master/sdk/src/genesis_config.rs

`local:demo` and `devnet:demo` are development supervisors, not production hosting.
They launch separate agent and owner processes, clear OpenAI keys from child
execution environments, persist private state in ignored directories and stop
only the processes they own. Interactive wallet onboarding, public-user custody,
production service supervision, restore exercises and visual browser QA remain.
