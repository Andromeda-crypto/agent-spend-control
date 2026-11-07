# Status — 2026-11-06

## Resume here

Branch: `feat/vault-agent-dashboard`. Starting checkpoints: implementation
`9b2f195`, verification notes `ee9579e`. This increment prepares the external demo;
Completed demo-polish work is committed and pushed to this branch for
the overnight handoff. No application or service has been published.

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

## Verified this increment

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
- No privileged console was published, no hosting/service provisioned, no real
  funds or billable API calls used.

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

The public replay is prepared as an isolated static artifact. Choose an existing
static host, publish **only `apps/replay/dist`**, and verify its HTTPS origin,
evidence loading, CSP/headers and mobile refresh there. No service is provisioned.
The prepared public container is an alternative, not a verified deployment.

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

## Overnight handoff

Implementation stopped at the user's request. The session-owned local demo
launcher and its gateway, worker, owner synchronizer, reference service, replay,
web, PostgreSQL and validator have stopped gracefully. Database, validator
ledger, wallet and private access files are retained; nothing was reset or
redeployed. The browser-tested local task is permanently revoked as expected.

**Exact next action:** review this checkpoint, choose an existing static hosting
destination for the public replay, then publish only `apps/replay/dist` and
verify HTTPS, evidence loading, headers and narrow-screen refresh on that origin.
Do not expose the operator console. Do not provision paid services or make
billable OpenAI calls without authorization. For another local walkthrough,
start `local:demo -- --new-task` using the command above; preserve prior state.
Docker/private-stack runtime and restore verification remain separate gates.
