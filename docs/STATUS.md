# Status — 2026-11-07

## Resume here

The approved **Orbit** layout is implemented in the public replay and private
Overview/Integration screens. A shared presentation component connects the
allowance hub to inspectable agent, request, receipt and policy nodes. The
private console uses actual selected-task balances and states; public values
remain explicitly recorded/illustrated. Owner approvals, signing and real
execution remain private.

Public Orbit release: **https://agent-spend-control-replay.vercel.app**.
Deployed source: `d0b4df3334220e6de75c82da3fd3e778f7cc400c`; deployment
`dpl_E7VNoXSmPuSMfiTt9kdfuvTjC8E4`. Anonymous hosted verification and file
hashes are in [public-replay.json](deployments/public-replay.json).
[PR #2](https://github.com/Andromeda-crypto/agent-spend-control/pull/2) carries
this increment. GitHub records its current check and merge status. Existing feature histories were merged through
[PR #1](https://github.com/Andromeda-crypto/agent-spend-control/pull/1).
No external customer adoption is claimed.

## Orbit interface increment — 2026-11-07

Implemented:
- Reflective allowance hub, spatial agent/purchase/receipt nodes, matte contextual
  decision bar and keyboard-operable Decisions/Receipts/Policy dock.
- Expandable exact request, usage and policy details; payment and delivery remain
  independent. Private inspection links lead to existing approval/receipt/setup
  controls. The research action remains connected to the real private workflow.
- Compact horizontal operator navigation, scrollable sections and stacked mobile
  composition. Removed the generic public hero/KPI-card arrangement.
- Shared `packages/ui/src/orbit.ts` and `orbit.css`; private data projection in
  `apps/web/src/orbit-model.ts`. No privileged code enters the replay bundle.
- Public integration documentation points to `main`; seven phase deep links,
  recorded Devnet evidence, TEST/service and simulated-model labels remain.

Verified:
- TypeScript, both production builds and 14 existing Node tests pass.
- Chrome static replay: restrictive CSP, seven phases, loading/error, keyboard
  focus, refresh and widths 1440/375/320; static GET requests only.
- Read-only Chrome design checks: public nodes/inspection/dock, private overview
  and Integration, modal fit/focus return, desktop/mobile, no credential rendering.
- Full local Chrome lifecycle passes: masked sign-in/error, funded task, research,
  exact approval, actual local 20/40 TEST payments, delivery/report, confirmed
  revocation, keyboard/modal focus, offline recovery and refresh.
- Anonymous hosted Chrome checks pass: HTTPS, security headers, direct phase
  links/refresh, 1440/375/320px, correct Devnet Explorer links, no console errors,
  privileged paths return 404, static GET-only traffic. Hosted files match the
  five-file audited upload byte-for-byte.
- Screenshots inspected. Existing backend/payment contracts are unchanged.

No Devnet program upgrade, replacement buffer or Devnet transaction was made.
Billable OpenAI calls remain unauthorized. Local verification uses preserved
PostgreSQL/validator state and a fresh bounded local TEST task.

## Developer pilot increment — 2026-11-07

Implemented:
- Source-local `referenceTool` for an existing agent: scoped credentials only,
  stable operation IDs, basic/premium service purchases, no model or owner signer.
- SDK `waitForRequest`, approval notification, deadline/caller cancellation,
  recoverable `PendingRequestError`, separate charge and delivery outcomes.
- Private Integration screen: task selection/readiness, allowance/limits,
  copyable code, setup progress, request outcomes and approval handoff. Credentials
  are never rendered. Navigation icons are decorative for accessible button names.
- Refined desktop/mobile integration design, plus a public developer-pilot entry
  point and guide link. Public replay remains entirely read-only.
- Professional README, integration guide, configuration template and runnable CLI.

Verified:
- TypeScript and private/public web builds; 14 Node tests.
- 16 combined real PostgreSQL/local-Solana tests, including an independent agent
  tool client: timeout recovery, no duplicate payment, exact approval, hard caps,
  changed-payload conflict and separation of owner/agent authority.
- Real Chrome + independent CLI process: basic 20 TEST payment, premium 40 TEST
  approval and delivery, integration receipts, retry returning the same request,
  1440/375px with no credential rendering or horizontal overflow. Screenshots
  reviewed. Public production-artifact and hosted Chrome checks pass; all public files
  match the audit byte-for-byte, the developer guide returns 200, and no public
  execution or private console was deployed.

The private local stack was used for two pilots while retaining all state: the
independent tool-client task has two settled deliveries (60 TEST spent), and a
fresh task exercises the actual built-in research agent below. No Devnet or
OpenAI execution occurred.

## Selected internal research pilot

User selected the existing `advanceResearch` agent at
`examples/reference-agent/workflow.ts`. Both its basic and premium requests now
call `submitReference` in `packages/sdk/src/reference-tool.ts`. The SDK exports
both the shared submitter and external `referenceTool` wrapper; the original
example module re-exports them for compatibility.

Internal calls use a transaction-bound `Store.reserveTrusted` submission port,
not HTTP or SDK polling under DB locks. The external wrapper uses the scoped
HTTP SDK and waits outside server transactions. The internal pilot therefore
preserves the existing trusted-worker boundary; external auth is separately tested.
Premium payload, `research:<run-id>:2` key, exact owner hash/version approval,
service scope, allowance enforcement and receipt/report evidence remain unchanged.
The full integration tests explicitly verify those invariants, two paid deliveries,
failed-delivery accounting, replay protection and simulated-model report labels.
The existing research-agent Chrome walkthrough passed after this routing change:
actual local payments and deliveries, exact approval, simulated report, reconnect,
refresh and confirmed revocation. The fresh pilot task is now revoked as the test
expects, with its receipts retained; the prior external-style task remains intact.
The local stack is running at the printed private URL for review; starting another
run requires a fresh bounded task or a suitable existing active task.
See [minimum integration changes and assumptions](INTEGRATION.md#first-internal-pilot-existing-research-agent).

## Verified public release — 2026-11-07

- Anonymous HTTPS returns 200 without login or a protection bypass. The stable
  production alias is public; deployment-specific/preview URLs may retain Vercel
  authentication. Share the stable URL above.
- Real Chrome: direct navigation and refresh for all seven `/#0`–`/#6` scenes,
  keyboard navigation, 1440/375/320px layouts, no horizontal overflow or browser
  JavaScript/console errors. Hosted screenshots inspected.
- CSP restricts scripts/styles/connections to self; HSTS, nosniff, frame denial,
  no-referrer and restricted Permissions-Policy observed on HTTPS responses.
- Browser requests were same-origin static GETs only: no Authorization, API,
  Solana RPC, model requests, wallet actions or live spending. Privileged and
  private-file paths and unsupported routes return 404.
- All four hosted public files match the audited build byte-for-byte.
- Hosted evidence exactly matches the allowlisted Devnet checkpoint. Read-only
  RPC independently reconfirmed both signatures finalized with no error. Both
  correct `?cluster=devnet` Explorer links returned 200 in Chrome. A plain HTTP
  client received Explorer 429; this third-party throttling does not affect the
  replay or invalidate the independently checked transactions.
- TypeScript, local production replay Chrome tests and static-package audit pass.
  A post-deploy test harness fix handles hash navigation as a full-document check;
  it changes no hosted replay assets. Deployment metadata confirms source SHA.
- CLI 65.12.1 installed globally and authenticated as `andromeda-crypto`. Existing
  Vercel plugin/connector retained. Connector project creation was denied; the
  authenticated CLI fallback created/deployed the verified project successfully.
  No duplicate project, Git auto-deploy connection, custom domain, paid service,
  model call or new Solana transaction was created.

**Preserved:** the verified Devnet program, authority, wallets, ledger and DB.
No program redeploy, upgrade, replacement buffer or Devnet transaction was made
in this increment. **Billable OpenAI calls remain unauthorized.** Launchers and
private container configuration keep live execution false; model output is
explicitly simulated. TEST token and reference service are self-operated.
No x402 support is claimed.

Program: `8A12uxD8G5fpV1tAJja61EB7fhUwksmaDwjGB9uqqGe6`.
Authority: `ATJeSsM6kshKaTp4MVipQaTksNpEdAvkYkc7ofY1rU9V`.
Existing public proof: [deployment](deployments/devnet.json) and
[two finalized payments](deployments/devnet-workflow.json).
Last previously observed deployer balance: 0.41962504 test SOL; not refreshed in
this increment. Private keys/access remain under ignored `.local/`.

## Implemented

- Existing owner/agent identity, rotations, tenant isolation, durable quota and
  lifecycle, exact approvals, bounded Anchor vault, binding/provisioning,
  reconciliation and actual paid service retained.
- Operator UX: clear network/model label before sign-in, demo guide, visible
  next action and research button, allowance definitions, exact approval context,
  separate payment/delivery outcomes and expandable technical receipts.
- Browser fixes: keyboard focus/open details survive polling, clearer errors and
  loading, connection status and automatic recovery, refresh retains selected
  task, confirmed chain revocation visible, improved narrow layout/contrast.
- Credential values no longer rendered in creation/rotation dialogs; private
  download only. Owner sign-in is masked. No credentials in public replay.
- Separate `apps/replay` public build: seven-scene guided replay, self-operated
  TEST/service and simulated-model labels, actual finalized payment evidence,
  and explicitly illustrated blocked/revocation scenes. No API or signing path.
- CI now builds the separate replay artifact (remote CI has not run here).
- Separate Vite caches fix real blank-screen/504 caused by competing optimizers.
  Launcher serves `/replay/` and preserves existing persistent local state.
- Portable public/private Docker targets, Nginx, Compose and per-role environment
  configuration. Private console bound only to loopback, public replay has no
  gateway proxy, only owner-signing process receives owner signer mount.
- [HOSTING.md](HOSTING.md): process placement, environment names, origins/auth,
  restart/persistence, migration/restore and privilege boundaries.
- [DEMO_SCRIPT.md](DEMO_SCRIPT.md): concise walkthrough, safe new-task procedure,
  fresh-visitor instructions and labeled replay fallback.

## Prior checkpoint verification — 2026-11-06

- TypeScript check and both production web builds pass.
- 10 Node tests, 7 real PostgreSQL/HTTP tests and 15 local program/full-workflow
  integration tests pass. Dependency install audit: zero vulnerabilities.
- Real Chrome walkthrough passes: masked sign-in/error, funded task, research,
  actual local 20/40 TEST transfers, approval, report, revocation observed on
  chain; keyboard/modal focus, offline/reconnect, refresh, desktop and 375px.
- Production replay browser check covers restrictive CSP, public-evidence
  allowlist, absence of operator code/known token, no API or Authorization
  requests, loading/error, all scenes, focus/refresh and 1440/375/320px.
- Screenshots inspected; findings/fixes in [BROWSER_QA.md](BROWSER_QA.md).
- Both Compose files parse as YAML; Docker schema/runtime validation remains.
- No privileged console was published and no real funds or billable API calls
  were used. The public replay was subsequently published as described above.

## Run / demonstrate

External visitor / reliable fallback, no credentials or toolchain needed:

```sh
npm ci
npm run replay:dev
# Public artifact only:
npm run replay:build
npm run test:replay
```

Private operator workflow (PostgreSQL 17 + existing Solana toolchain/build):

```sh
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run local:demo -- --new-task
# While the stack runs, separate terminal:
npm run test:browser
```

Open printed dashboard URL, normally `http://127.0.0.1:5174`. Masked owner sign-in
uses the private access file locally; never show it to an audience. The browser
check consumes/revokes one local task, so use `--new-task` before repeating.
The latest local access file points to a browser-tested, revoked task; seed a
new task before starting another run. Prior tasks and receipts are preserved.
Keep prior data; do not reset uncertain payments. Ctrl+C gracefully stops owned
processes and waits for local ledger finality.

Existing Devnet interactive demo remains operator-controlled:
`PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run devnet:demo -- --new-task`.
This funds another bounded TEST task using existing identities; it does not
redeploy. It requires free test SOL for fees/rent. See [LOCAL_DEMO.md](LOCAL_DEMO.md).
Do not run `devnet:deploy` merely to resume this work.

## Hosted readiness / smallest blockers

The public static replay is deployed and verified. There is no remaining hosting
blocker for that read-only milestone. The current release is manually uploaded;
repository pushes do not auto-publish. Rebuild/audit/redeploy only the isolated
artifact, never deploy the repository root. See [HOSTING.md](HOSTING.md).

Docker is unavailable here: Dockerfile image builds, Compose runtime and mounted
signer UID access still need verification on a Docker-equipped machine. The
private stack also needs DB backup/restore validation and SSH/VPN/tunnel checks
before moving existing operator state. Public visitor execution isolation is
not implemented: keep Devnet live execution private. The owner-signing process
trusts the operator DB; it is not independent review against a compromised host.

Native mobile/browser and screen-reader checks, hosted login/credential recovery,
DB least privilege, monitoring, rate limits, supervised schedules and broader
security review remain product work. Actual OpenAI integration remains mock-
tested only until fresh explicit cost authorization and secure configuration.

## Next action

Review the public Orbit layout and private Integration screen with the next
developer. The most recent full-browser local task completed and was revoked;
use `--new-task` for another execution.
Use [INTEGRATION.md](INTEGRATION.md) to connect the next agent: for the same
reference service, supply scoped URL/task/token and replace one tool call while
persisting operation IDs. A different paid tool needs its own validated wrapper,
trusted adapter, gateway execution gating and compatible policy/binding; changing
an endpoint alone is insufficient. Provider payment compatibility and idempotent
lookup remain assumptions to verify. No actual external adopter is claimed.

Keep the operator stack private and test-token-only. Broad login/self-service,
npm SDK distribution, additional service adapters and a hosted live backend are
later milestones. Docker/restore verification is still required before moving
private infrastructure. Preserve Devnet and private state; no billable OpenAI,
public live execution or x402 support is authorized/claimed.
