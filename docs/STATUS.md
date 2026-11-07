# Status — 2026-11-06

## Return here first

Branch: `feat/vault-agent-dashboard`. Previous checkpoint: `b67a434` on
`feat/durable-request-lifecycle`. This branch contains the reviewed local vault,
identity, adapter/workflow, and dashboard increment. The user requested this
checkpoint before returning to continue development.

**No billable OpenAI calls are authorized.** The user selected “Prepare
integration; no billable calls yet.” The environment check reported
`OPENAI_API_KEY` **not set** without printing any value. Keep
`ENABLE_LIVE_EXECUTION=false`. Do not infer authorization from the existence of
a key or from the live-execution environment flag in a future session.

No Devnet deployment exists. The request for 2 free Devnet SOL failed with the
CLI's airdrop/rate-limit error. No real funds were used.

## Four requested milestones

| Milestone | Current state |
|---|---|
| 1. Owner/agent identity, rotation, tenant isolation | Implemented and tested for developer owner-key authentication. Explicit owner, agent, credential and audit records; single-use owner rotation; agent rotation/revocation; cross-workspace API denial. Email/SSO is not implemented. |
| 2. Local Solana vault, restrictions, Devnet | Anchor program compiles to SBF and passes actual local-validator transactions. Devnet funding/deployment is blocked and not complete. |
| 3. Real API, paid service, reference agent | OpenAI adapter, receipt-verified self-operated reference-service code, Solana adapter, separate owner sync command and durable four-step research workflow exist. Fixture flow is verified end to end. Live provisioning/binding and actual paid-service/OpenAI integration are unfinished and unverified. |
| 4. Dashboard around the workflow | Responsive dashboard builds and its fixture setup → task → approval → report flow passes DOM + real HTTP/PostgreSQL tests. Live onboarding, production routing/hosting, real-browser visual/mobile/accessibility QA remain. |

Stage 0 remains complete. The overall four-milestone product is **not complete**.

## Implemented behavior

- Migration 003 backfills explicit owners, task agents and credential hashes.
  Old rotated credentials stay revoked and cannot bootstrap old workspace access.
- Owner/agent credential rotation, agent revocation, identity listing and owner
  registration endpoints. Owner and agent authority remain separate.
- Policies identify asset kind, cluster, mint, symbol and decimals. Existing
  policies default to clearly labeled fixture units. Assets cannot be changed
  in place, and vault-bound policies cannot be edited in place.
- Program-controlled SPL task vault: owner deposit/withdrawal, agent purchases,
  fixed mint/recipient, policy version, expiry, irreversible revocation, total
  and per-payment hard caps, soft approval threshold, scoped owner exceptions,
  permanent purchase receipts and atomic transfer/counter update.
- Modular Solana client, persisted signed transaction attempts, finalized Devnet
  receipt checks, agent-signed delivery proof, and self-operated basic/premium
  reference-service code. These live integration components need end-to-end tests.
- OpenAI Responses adapter using AI SDK, bounded output, no automatic retries,
  privacy-conscious response storage disabled, and persisted reported token
  usage. API dollar billing is separate from the SPL budget and is not claimed
  to be a confirmed charge or a hard monetary cap.
- Four-step research workflow: plan → basic reference → premium reference
  requiring approval → report. State survives processes; fixture execution is
  fully tested. Model output cannot increase authority or approve purchases.
- Fixture worker watch mode and oldest-checked-first bounded reconciliation.
  Owner-wallet loading is confined to a separate operator command; the agent
  worker loads only the restricted agent signer.
- Dashboard: owner setup/key sign-in, task creation, selected-task balances,
  approval inbox, timeline, receipts, export, policy editing, pause/resume/revoke,
  key rotation and final report. Dynamic text is escaped; HTML injection through
  a research topic is covered by the integration test.

## Review findings addressed

1. Connected the dashboard's `/api` routes and authenticated configuration
   endpoint to the gateway; the proxy flow now passes the actual HTTP test.
2. Removed owner-wallet loading from the agent runtime; introduced `owner:once`.
3. Kept unbound/unapproved on-chain work reserved instead of dispatching it
   before a vault binding or on-chain exception exists.
4. Prevented edits to bound on-chain policies and changes to asset identity.
5. Replaced legacy Solana dependencies with modular clients; final npm audit
   reports zero vulnerabilities.
6. Ensured `.local/`, keypairs, build output and environment files are ignored;
   checked representative generated wallet/build paths with `git check-ignore`.

## Verified commands and evidence

```sh
npm run check
npm test
npm run demo
npm run web:build
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run test:postgres
cargo test -p spending-vault --lib
npm run vault:build
npm run test:solana
npm audit --json
```

- Node: 8 tests passed, including mocked OpenAI execution with **no network call**.
- PostgreSQL: 7 tests passed, including races, rollback, crash/restart recovery,
  cross-tenant denial, concurrent owner rotation and the dashboard fixture flow.
- Rust: 4 tests passed (program ID plus expiry, overflow and authority/limit rules).
- Local validator: 8 tests passed (parent plus 7 restriction scenarios), using
  the compiled SBF program and actual local test-token transfers. Covered
  permitted transfer, replay, direct token-transfer bypass, signer/recipient/
  mint/version rejection, exact exceptions, hard caps, competing purchases,
  revocation, withdrawal and expired-policy creation.
- Dashboard production bundle built successfully. CI now also builds the web app;
  remote GitHub Actions has not been run for this checkpoint.
- Audit: 0 vulnerabilities across the current npm dependency graph.

The SBF program was built successfully with Solana CLI 2.3.0 and platform-tools
v1.58. `npm run vault:build` provides the reproducible wrapper for that build.
The older v1.48 compiler failed on an edition-2024 dependency. Native Rust is
1.99.1; Anchor crates are 0.32.1 with locked transitive dependencies. Anchor CLI
is not installed or required by these commands. The legacy build tooling emits
nonfatal configuration/syscall post-processing warnings; the binary passed the
local runtime tests. Investigate these before a public release.

This checkpoint has not had a fresh-clone install check; the previous checkpoint
had one. No real OpenAI request, Devnet deployment/payment, paid reference-service
end-to-end run, real-browser visual review, hosted deployment or backup/restore
has been verified. DOM verification is not a substitute for browser visual QA.

## Resume the working fixture dashboard

Use Node >=22.12 and PostgreSQL 17. Copy `.env.example` to ignored `.env.local`
and configure the local database; retain fixture enabled and live disabled.
The commands load `.env.local` automatically.

```sh
npm ci
# Start PostgreSQL using Compose, or your local PostgreSQL installation.
npm run migrate
npm run dev
```

In separate terminals:

```sh
npm run worker:watch
npm run web:dev
```

Open http://127.0.0.1:5173. Create a workspace, save its owner key, and start a
fixture research task. Approve the 40-unit premium request to resume it.
Use the terminal-only `npm run demo` if PostgreSQL is unavailable.

For local chain checks:

```sh
cargo test --locked -p spending-vault --lib
npm run vault:build
npm run test:solana
```

Local keys are retained only under ignored `.local/`:
`program-keypair.json` and `devnet-deployer.wallet.json`. Do not print private
key material or commit these files. The declared program ID matches the local
program keypair. Fresh clones can run genesis-loaded local tests without that
private key; deploying under the same ID requires the original keypair. The
local genesis-loaded program has upgrades disabled. A future Devnet deployment
must select/disclose its upgrade authority and record explorer links.

## Exact next action

Add a **local end-to-end live-path test** that uses the actual vault +
`SolanaAdapter` + signed reference-service delivery + durable usage ledger, while
mocking OpenAI so there are no billable calls. Implement secure task-to-vault
provisioning/binding and validate its owner, agent, asset, limits and version.
Test owner exception synchronization, failed delivery after payment, ambiguous
submission and revocation confirmation through that path. No public vault
binding/provisioning API or complete setup script exists yet; the current live
adapter code is not enough to run the complete workflow from the dashboard.

Then obtain free Devnet SOL for the dedicated deployer, deploy the locally tested
program, disclose upgrade authority and record receipts/explorer links. Do not
buy SOL, use mainnet or pay an RPC provider without concrete authorization.

Only after the user explicitly authorizes billable calls and securely configures
OpenAI credentials should an actual OpenAI + Devnet research workflow run.
Finally perform real-browser/mobile QA, measure sample onboarding, supervise
workers, configure hosting and complete backup/restore checks.

Additional product-grade work remains: email/SSO, wallet onboarding, secret
rotation/recovery UX, rate limits, database least privilege, pagination/retention,
observability, worker supervision, hardened operator tools and security review.
Current owner-key sessions are a developer bootstrap stored in browser session
storage; the operator processes are trusted infrastructure, not isolated wallets
for untrusted public users.
