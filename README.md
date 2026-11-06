# Agent Spending Control

Portable policy and durable request foundation for the November 6–8 Solana hackathon.
This is an early backend increment; there is no dashboard, real provider or blockchain payment yet.

Requires Node >=22 and PostgreSQL 17 (Docker Compose supplied).

```sh
npm ci
npm run check
npm test
docker compose up -d
export DATABASE_URL=postgres://spend:local-only@localhost:5432/spend
npm run migrate
npm run dev
```

Gateway listens on localhost:3001. All routes require a high-entropy Bearer
credential (at least 32 URL-safe characters). Create a task with a new owner
credential; store it securely. The returned agent credential can only submit
requests for that task. Credentials are stored as SHA-256 hashes; use TLS for
any hosted gateway. This development bootstrap creates a workspace per task;
it is not a user account/login system.

POST /tasks accepts a strict policy object:
```json
{"budget":"100","perRequest":"80","approvalAbove":"30","calls":4,"expiresAt":"2026-11-09T00:00:00Z","providers":["fixture"],"tools":["search"],"recipients":["reference"]}
```
POST /tasks/:task/requests requires an Idempotency-Key header and:
```json
{"provider":"fixture","tool":"search","recipient":"reference","amount":"20","input":{"query":"Solana research"}}
```
POST /tasks/:task/requests/:id/approve requires the owner credential.
POST /tasks/:task/pause and /tasks/:task/revoke require the owner credential.
Large integer monetary units are strings. Allowlist and budget failures are
hard failures; approval only overrides the soft approval threshold.

See [status](docs/STATUS.md), [architecture](docs/ARCHITECTURE.md), and
[Solana investigation](docs/STAGE2.md). PostgreSQL is the runtime store;
tests use embedded PostgreSQL through PGlite. Never use fixture tests as evidence
of real API charges or on-chain payments.
