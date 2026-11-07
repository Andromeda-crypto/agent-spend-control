# Status — 2026-11-07

## Resume here

Branch: `feat/vault-agent-dashboard`. Public replay is live:
**https://agent-spend-control-replay.vercel.app**

Deployed source commit: `d7f4c26f7c050b57db766c281123d29d2fb8923d`.
Vercel project: `agent-spend-control-replay` in `om-anands-projects` (Hobby).
Production deployment: `dpl_8HBSdDX1sYWBo5QMe3kXfALGB8kN`, READY.
Only the locally built replay artifact and public security configuration were
uploaded: five files, no repository sources, private env/config or runtime.
The operator console and all live execution remain private and stopped.
See [public release evidence](deployments/public-replay.json).

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

## Preserved local state / next action

The previous session's gateway, worker, owner synchronizer, reference service,
PostgreSQL and validator remain stopped. This release used only temporary
browser tests, static packaging and read-only chain inspection. Databases,
validator ledger and private wallet/access files were retained. The last
browser-tested local task is revoked as expected; seed a new bounded local task
only when resuming the private workflow. Do not reset existing state.

**Exact next action:** share the public replay and collect demo feedback. The next
engineering milestone is Docker/private-stack runtime and DB backup/restore
verification, followed by private hosted access checks. Public live visitor
isolation is still unimplemented; no public execution or billable OpenAI calls.
Do not run Solana deployment/upgrade commands to resume this work.
