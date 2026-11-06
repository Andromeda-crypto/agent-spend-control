# Status — 2026-11-06

## Baseline and checkpoint

The initial repository contained only a README and an initial commit. The
first implementation checkpoint was da7fa04 on feat/durable-request-lifecycle.
This increment continues on that branch. Node 26.12.1 / npm 11.20.0 are available.
PostgreSQL 17.11 was installed through Homebrew for real-database verification;
the tests use a disposable cluster, not a persistent background service.
Docker, Rust, Solana CLI and Anchor have not been installed by this increment.

## Implemented

Stage 0: pinned dependencies/lockfile, TypeScript checks, CI, reproducible
embedded fixture terminal demo, local PostgreSQL service configuration, setup
and architecture documentation. Fresh-clone verification is the final check
for this checkpoint.

Stage 1, durable lifecycle increment:

- Task-scoped agent credentials independent of owner credentials; owner token
  reuse now reuses the workspace.
- A shared single-connection transaction boundary at READ COMMITTED, with task
  locks serializing budget and API-call quota reservations.
- Complete-payload idempotency, hard limits, expiry and allowlists.
- Owner approvals bound to payload hash and policy version; dispatch rechecks
  them. Approval retries cannot reserve twice.
- Owner policy editing with expected-version checks; stale pending work is
  cancelled. Pause/resume/revoke controls; revocation is irreversible.
- Explicit HTTP/SDK schemas, task snapshots, totals and event timelines.
- A bounded worker with trusted local quotes, durable dispatch IDs and adapter
  versions. External execution runs outside database transactions.
- Read-only recovery of uncertain dispatched requests; no automatic resend.
- A unique usage ledger with confirmed amount, consumed calls, delivery outcome
  and receipt. Settlement retries cannot double-charge or rewrite evidence.
- Ordered, transactional, checksum-checked migrations, including adoption of
  the previous checkpoint's unversioned schema.
- A self-operated fixture adapter and local TypeScript SDK. The adapter is
  explicitly synthetic and must be opted into; it is not a real API/payment.

Stage 2 remains preparation only: official-source compatibility investigation
and program test plan in STAGE2.md. No Solana program or compatibility claim.

## Verified

Commands passed:

```sh
npm run check
npm test
npm run demo
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run test:postgres
```

Six embedded-database tests cover hard/soft limits, credentials, recipient
allowlists, expiry, exact approvals, policy replacement, trusted quote checks,
confirmed cost vs delivery and conflicting settlement rejection.

Five PostgreSQL integration tests cover eight competing budget reservations,
eight competing API-quota reservations, concurrent idempotent retries,
changed-input conflicts, rollback, competing owner revocation, concurrent
worker claims, provider execution outside task locks, repeated settlement,
migration adoption/checksums, SDK/HTTP authorization, and an actual killed and
restarted gateway. A fresh worker process reconciles a synthetic lost provider
response; the test checks one provider receipt and one usage record even when
the owner revokes before reconciliation.

CI now includes a PostgreSQL 17 service and the real-database suite. CI itself
has not been run remotely. No real API, container deployment, Devnet payment,
x402 settlement or backup/restore has been verified. The previous dependency
audit reported zero vulnerabilities; this increment adds no dependencies.

## Remaining and exact next action

Stage 1 is still partial. Owner authentication is a high-entropy developer
bootstrap rather than interactive login. Explicit agent/owner records,
credential rotation, workspace onboarding and policy templates remain. The
worker is a bounded one-pass command; fair scheduling/backoff, provider-specific
reconciliation and operator tools are outstanding. Snapshot pagination,
resource-level database privileges and production deployment also remain.
The SDK is source-local and the reference result is synthetic.

Next action: add explicit owner/agent lifecycle records and credential rotation
with cross-workspace authorization tests. Then install/pin Rust, Solana CLI
and Anchor, implement and test the program-controlled vault locally, and wire
one real provider adapter using its documented cost bound and reconciliation
semantics. Keep ambiguous work reserved. Do not enable real spending until
those integrations have a concrete end-to-end test and approved operating cost.

No domain purchase, paid service, wallet keypair or real funds were used.
