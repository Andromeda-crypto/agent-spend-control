# Architecture and recovery

packages/policy: strict schemas and deterministic policy validation.
apps/gateway: Node HTTP entrypoint and PostgreSQL lifecycle operations.
Other directories reserve the planned module boundaries; they are not delivered features.

Every HTTP lifecycle operation uses a short database transaction with a task
row lock. Lock order is task then request. The task lock serializes allocation
and owner controls across requests. Payload comparisons include all parsed
fields; unknown fields are rejected. No outbound services run in transactions.

Store methods require the caller to supply an explicit transaction for concurrent
use. They are not safe to call directly on an untransactioned connection in production.
The worker must use transactions around dispatch and finalization, with external
calls strictly between those transactions. Dispatch revalidates policy and
identity. Completion methods are internal only; agents cannot self-report
completion through HTTP. No arbitrary URL proxy exists.

States: approval -> reserved -> dispatched -> succeeded/failed.
Pause/revoke cancels approval/reserved requests and releases reservations.
Dispatched requests remain pending, retaining reservations through revocation.
A timeout must not be marked failed. There is intentionally no automatic retry
of dispatched work. Recovery must reconcile provider receipts before deciding
success/failure; worker/provider reconciliation is still to be implemented.
Policy edits are not exposed. Version bindings are checked on approval/dispatch.

Back up PostgreSQL with pg_dump and restore into a separate database using
pg_restore before switching traffic. Run migrations first. Restarting the
HTTP gateway does not clear rows. Do not delete the Compose volume for recovery.
The migration is rerunnable for the initial schema; a versioned migration
runner is needed before introducing subsequent schema changes.
