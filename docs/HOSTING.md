# Hosted demonstration plan

The public product is the **read-only replay**, built from `apps/replay`. It has
no backend connection, sign-in, owner credential, wallet, or execution controls.
The operator console is a separate build and private service. Live Devnet
execution remains operator-controlled: visitor session isolation is not yet
implemented or tested. Nothing here provisions a service or changes the program.

## Process placement

| Component | Concrete placement | Public access | Signing / state |
|---|---|---|---|
| Public web | Static host or `public-replay` Nginx container | Anonymous HTTPS | Public allowlisted evidence only; no database or secrets |
| Operator console | `operator-console` Nginx on host loopback `8081`, accessed through SSH/VPN | None | Owner bearer credential in tab session storage; never in URL or HTML assets |
| Gateway | Long-lived Node 24 container on private Compose network | Only private console reverse proxy `/api/` | PostgreSQL; public chain configuration; no wallet mount |
| Agent worker | Separate long-lived Node container, supervised restart | No inbound listener | Restricted agent signer only; durable dispatch/receipts in PostgreSQL |
| Reference service | Node container on private network `3002` | Worker only in this plan | Reads chain proofs; no owner/agent signer; self-operated TEST service |
| PostgreSQL | PostgreSQL 17 container + named persistent volume | No host port | Reservations, requests, signed dispatch wires, approvals, provisioning, research state |
| Owner-signing component | Separate Node container on trusted operator host | No inbound listener | Only process mounted with owner signer; observes exact approved decisions and revocation rows |

The host administrator and database are trusted operator infrastructure.
The current owner signer trusts authenticated decisions persisted in that database;
a compromised gateway/database could manufacture decisions. Keep this stack
private. Hardware/remote signing with independent transaction review and scoped
DB roles are future work before a public multi-user service. Agent restriction
does not provide OS isolation against a host administrator.

## Portable artifacts

Public replay only:

```sh
npm ci
npm run replay:build
# Publish ONLY apps/replay/dist on an existing static host, or, with Docker:
docker compose -f deploy/replay.compose.yaml up --build -d
```

The container serves port 8080; put an existing HTTPS ingress in front of it.
The Nginx configuration blocks `/api`, applies a restrictive CSP, and serves only
static files. No environment variables are required. For subpath hosting set
`REPLAY_BASE` at build time and retain its evidence.json and asset paths.
No operator bundle is in this image. Build context excludes `.local`, `.env*`,
wallets, dependency directories, Git history and build artifacts.

Private operator stack (configuration prepared, container runtime verification
still required on a Docker-equipped machine):

```sh
cp deploy/operator.env.example deploy/operator.env
chmod 600 deploy/operator.env
# Configure privately; never paste values in chat or put them in shell history.
docker compose --env-file deploy/operator.env -f deploy/operator.compose.yaml config --quiet
docker compose --env-file deploy/operator.env -f deploy/operator.compose.yaml up --build -d
# From the operator's workstation, use a private tunnel to host loopback 8081.
```

Use existing signer files, TEST mint and recipient; **do not run deployment**.
The deployment JSON records the verified program and upgrade authority. Mount
only copies of the required existing signers using restricted host permissions,
readable by container uid 1000. On a Linux operator host, make restricted
service-owned copies (uid/gid 1000, mode 0400) outside the checkout; preserve the
originals. Compose file-backed secrets retain host permissions. Do not mount the deployment buffer or program
keypair. Confirm file access as the runtime user before starting signing.
The runtime image intentionally includes the pinned tsx development dependency
because source is executed with the Node loader. Build/minimize a compiled
runtime separately before treating it as a production distribution.

The Compose private database starts empty unless restored. Before switching an
existing operator stack, stop its writers, back up PostgreSQL and private access
configuration, restore into the target volume, run ordered migrations, and check
existing task/binding/signature rows. Test restoration before cutover. Do not
start two independent databases against the same tasks/signers or seed over
existing state. Provisioning is an explicit operator command, not a container
startup side effect. The configuration does not seed, fund, mint, deploy or
replace wallets automatically.

## Environment names and boundaries

Values belong in the ignored private env file or runtime secret mounts.

| Names | Receives them |
|---|---|
| `DATABASE_PASSWORD` | Database only; Compose input |
| `DATABASE_URL` | Migration, gateway, worker, owner-signing; explicitly blank for reference |
| `SOLANA_CLUSTER`, `SOLANA_RPC_URL`, `SOLANA_PROGRAM_ID` | Gateway, worker, owner-signing, reference; Devnet only in this plan |
| `REFERENCE_MINT`, `REFERENCE_RECIPIENT`, `AGENT_PUBLIC_KEY` | Public chain configuration for those private processes |
| `ENABLE_FIXTURE_ADAPTER`, `ENABLE_DEVNET_DEMO_MODEL`, `ENABLE_LOCALNET_MODEL`, `ENABLE_LIVE_EXECUTION` | Private processes; live false, Devnet simulation true, local false |
| `AGENT_WALLET_FILE` → `AGENT_WALLET_PATH` | Compose file input → worker secret mount only |
| `OWNER_WALLET_FILE` → `OWNER_WALLET_PATH` | Compose file input → owner-signing secret mount only |
| `REFERENCE_SERVICE_URL` | Worker, internal service URL |
| `HOST`, `PORT`, `REFERENCE_PORT` | Internal listener configuration; no host-published API ports |
| `GATEWAY_TARGET`, `REPLAY_TARGET` | Local Vite development proxy only; not client secrets |
| `REPLAY_BASE` | Public replay build/development asset base |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Not provided. Billable calls remain unauthorized; key is explicitly blank in Compose |

`OWNER_TOKEN` is only needed for explicit operator provisioning commands; it is
not injected into the gateway, worker, static web or owner-signing watcher.
Never use `VITE_*` for a secret: those values can enter public bundles.

## Authentication and origins

The operator first reaches a private SSH/VPN route, then signs in with an owner
bearer credential. The console and gateway share an origin through `/api/`, so
no permissive CORS is needed. The gateway emits no Access-Control-Allow-Origin
header, does not use cookies for authentication, and requires a bearer token for
task/identity APIs. `/health` and `/session` expose only health and mode labels.
Do not expose registration or the developer console anonymously. If replacing
the tunnel with a hosted identity-aware proxy, protect **both static console and
API routes**, verify WebSocket/reverse proxy behavior and apply TLS, rate limits
and access logging with Authorization/header/body redaction.

Public replay origin has no proxy to gateway and no operator sign-in link. It
loads a small allowlisted JSON artifact of already public evidence. Signatures
are public; owner tokens and wallet files are never copied into that artifact.

## Persistence, restart and acceptance gates

The DB volume is durable; container filesystems are not. Signed transactions are
saved before submission, and worker reconciliation retains uncertain reservations.
An automatic restart must reuse DB, mint, task identities and signer mounts.
Do not turn pending work into a new payment after a timeout. Migration runs to
completion before gateway/worker/owner watchers start. Stop writers gracefully
before backup or migration. Owner-signing downtime leaves decisions pending,
not implicitly authorized. Monitor pending age, worker failures and signer test
SOL balance without logging credentials.

Before hosting the replay: build and inspect the isolated output, test refresh,
mobile, keyboard and evidence links on the target origin, validate CSP and TLS.
Before hosting the private live stack: run Docker configuration/build/smoke,
restore test, confirm UID/mount permissions and tunnel isolation, then run one
bounded test-token session. These containers have not been run here because
Docker is unavailable. Both Compose files parse as YAML with aliases; this
is not Docker schema/runtime validation. No hosting account, paid service or DNS was provisioned.
