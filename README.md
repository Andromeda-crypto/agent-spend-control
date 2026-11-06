# Agent Spending Control

A portable backend for delegating bounded resources to agents. Built in stages
for the November 6–8 Solana hackathon. Current execution uses synthetic fixture
data; there are no real provider calls or blockchain payments yet.

## Run the foundation

Requires Node >=22 (CI targets 24; local verification used 26).

```sh
npm ci
npm run check
npm test
npm run demo
```

The terminal demo runs an embedded database, creates a task, executes a fixture
request, requests owner approval, blocks an unapproved recipient, and revokes
authority. All charges and results are explicitly synthetic. No credentials,
Docker, network calls or funds are needed for the demo.

## Run the durable HTTP gateway and worker

Requires PostgreSQL 17. Use the supplied Compose service or an existing local
instance. Set environment variables in your shell or your host's secret store;
`.env.example` documents them but is not automatically loaded.

```sh
docker compose up -d
export DATABASE_URL=postgres://spend:local-only@localhost:5432/spend
npm run migrate
npm run dev
```

The gateway defaults to `127.0.0.1:3001`. In a second terminal with the same
DATABASE_URL, run a bounded worker pass:

```sh
ENABLE_FIXTURE_ADAPTER=true npm run worker:once
```

Each pass processes up to 100 reserved requests and reconciles up to 100
dispatched requests. Run another pass after an approval or lost response.
There is no automatic scheduler yet. The fixture adapter accepts only
`fixture / search / service`, reserves exactly `"20"` synthetic units, and
returns an explicitly synthetic research result. No arbitrary URL proxy exists.

## Verify real PostgreSQL concurrency and recovery

Install PostgreSQL 17 binaries, then run:

```sh
npm run test:postgres
# macOS Homebrew, if the binaries are not on PATH:
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run test:postgres
```

The runner creates a temporary cluster on localhost, runs multi-connection and
fresh-process tests, then stops and removes the cluster. It does not start a
login service or alter an existing database. Alternatively use a disposable
PostgreSQL database (the tests create persistent synthetic rows):

```sh
TEST_DATABASE_URL=postgres://spend:local-only@localhost:5432/spend_test \
  node --import tsx --test 'test/postgres/*.test.ts'
```

CI runs these integration tests against a PostgreSQL 17 service.

See [HTTP/SDK integration](docs/API.md), [architecture and recovery](docs/ARCHITECTURE.md),
[current status](docs/STATUS.md), and [Solana investigation](docs/STAGE2.md).
