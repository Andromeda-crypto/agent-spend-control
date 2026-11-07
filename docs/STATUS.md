# Status — 2026-11-06

## Start here

Branch: `feat/vault-agent-dashboard`.
The previous staged checkpoint was committed as `a37f078` at the start of this
session. Implementation checkpoint: `9b2f195`. This increment completes the secure provisioning and complete local
payment/service/dashboard workflow that checkpoint was missing.

**Billable OpenAI calls remain unauthorized.** The user selected “Prepare
integration; no billable calls yet.” The current process reported the API key
not set without printing a value. The demo launchers explicitly remove OpenAI
credentials from child environments and set live execution false. A future key
or environment flag does not override the user's restriction.

The user funded the dedicated deployer with **2 free Devnet SOL**. Deployment
is finalized and verified against the tested binary and disclosed upgrade
authority. Public evidence: [deployment](deployments/devnet.json) and
[complete payment workflow](deployments/devnet-workflow.json). The Devnet smoke
completed two finalized payments (60 TEST total), owner approval and a report.
The TEST mint is self-operated and the model is explicitly simulated.

## Requested milestones

| Milestone | Current state |
|---|---|
| Owner/agent identity and rotation | Implemented; workspace isolation, single-use owner rotation and agent credential lifecycle are tested. Developer owner-key sign-in remains; email/SSO is future work. |
| Solana enforcement | Local restrictions and atomic transfers verified. Secure funded provisioning/binding and actual payment/service integration now pass. Devnet deployment and complete test-token workflow now verified. |
| API, paid reference service and research agent | Local and Devnet paths verified, including paid delivery, approval and report; recovery failure scenarios tested locally. OpenAI adapter is implemented and mock-tested; actual OpenAI calls are intentionally not run. Test-cluster demos use a clearly simulated model. |
| Dashboard | Fixture and actual local-validator payment workflows tested through DOM + real HTTP, PostgreSQL, worker and service. Real-browser visual/mobile QA and production hosting remain. |

Stage 0 remains complete. Do not describe the overall product as production-ready
or all live integrations as complete.

## New behavior

- Owner-only `/tasks/:id/vault` binding requires an Ed25519 proof covering the
  workspace/task, canonical policy hash/version, program, cluster, mint,
  agent and recipient. The gateway independently checks on-chain identities,
  limits, expiry, decimals, account ownership/delegation, PDA derivation and funding.
- RPC inspection runs outside transactions; owner authority and policy version
  are rechecked under the task lock before binding. Cross-workspace, agent-only,
  forged, mismatched-policy and mismatched-task bindings are rejected.
- Creation + deposit use one atomic Solana transaction. Its signed wire and
  signature are persisted before submission. Retries reuse that same transaction
  and cannot deposit twice, even after legitimate spending. Saved plans freeze
  their policy; ambiguous provisioning is retained for investigation.
- Owner exception synchronization rechecks the exact approved payload/version.
  Revocation is shown as confirmed only after the chain state is observed.
  Owner signing remains in a separate operator process from the restricted agent.
- Chain settlement verifies the receipt, expected signature and actual transaction
  accounts. Ledger entries keep token amount, delivery outcome, fee lamports and
  receipt-account rent separate. A failed delivery remains charged if paid.
- One active research run per task. Four steps use fixture, local, devnet-demo or
  live mode with explicit labels. Simulated model output never claims an OpenAI
  request. Actual model token/dollar usage is not invented.
- `local:demo` starts persistent local PostgreSQL, validator, gateway, service,
  worker, owner synchronizer and dashboard. It seeds a signed, funded task and
  keeps private access data in ignored files, never console output.
- `devnet:demo` uses the actual Devnet program and a self-operated TEST mint with
  a simulated model. Its successful smoke run writes public evidence to
  `docs/deployments/devnet-workflow.json`; absence means not yet verified.
- Public RPC requests are paced and HTTP 429 retries respect Retry-After while
  preserving the original payload. Complete genesis hashes prevent mainnet use;
  regression tests reject truncated chain references and mainnet behind localhost.
- Ordered migrations 006 and 007 add provisioning plans and explicit demo modes.
  Applied migrations 001–005 were preserved.

## Verified so far in this increment

```sh
npm run check
npm test
npm run web:build
npm run demo
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run test:postgres
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run test:integration
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run local:demo -- --smoke
npm run devnet:plan
```

- 10 Node tests: policy/authentication, mock OpenAI usage, full genesis identities,
  serial RPC execution, identical-payload retry and Retry-After handling.
- 7 PostgreSQL/HTTP tests: reservations, quota races, rollback, restart recovery,
  tenant isolation, concurrent owner rotation and the fixture dashboard flow.
- 15 combined tests: local program restriction suite plus full dashboard → API →
  vault → authenticated paid service → ledger → report workflow. This includes
  concurrent provisioning, exact binding proofs, lost submission response with
  one payment, premium owner approval, failed delivery that stays charged,
  idempotent re-provisioning after spending, and reconciliation after revocation.
- The multi-process launcher smoke test passed with two actual local SPL
  payments, 60 TEST spent, zero reserved, and simulated model responses.
- Devnet deployment and smoke passed: two finalized on-chain payments, 60 TEST,
  approval and authenticated delivery, with fee/rent evidence saved publicly.
- Local startup now waits for successful transaction simulation before writes,
  and shutdown waits for finality. State is preserved across restarts.
- Prior checkpoint: 4 native Rust tests and the SBF build passed. Rust program
  enforcement source is unchanged in this increment.

Fresh checkout of `9b2f195`: `npm ci` (zero audit vulnerabilities),
TypeScript check, production web build and fixture terminal demo all passed.
The local multi-process smoke also passed on two successive retained-state
launches. The full chain suite uses this machine's installed toolchain/build;
a clean-machine toolchain installation has not been independently reproduced.
Remote CI, real-browser visual QA, production hosting and restore tests have not
been run. No billable API request or real-money transaction was made.

## Run it

The complete instructions are in [LOCAL_DEMO.md](LOCAL_DEMO.md).

```sh
npm ci
npm run vault:build
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run local:demo
```

Open the printed dashboard URL (normally http://127.0.0.1:5174) and sign in with the private owner token from
`.local/local-demo-v2/access.json`. Run the funded task and approve its premium
purchase. Ctrl+C stops only the processes started by the launcher and preserves
the database and ledger. `--new-task` seeds another bounded task under that owner.
Local ledgers are tied to their program binary hash; preserve old state before
starting a new demo after changing the program build.

After a verified Devnet deployment:

```sh
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run devnet:demo
```

Its private access file is `.local/devnet-demo/access.json`. Never paste owner
keys or wallet data into chat. All such files and build artifacts are ignored.
Owner credential rotation intentionally requires updating private access config;
old tokens are not silently reactivated.

## Devnet deployment state and recovery

- Program: `8A12uxD8G5fpV1tAJja61EB7fhUwksmaDwjGB9uqqGe6`.
- Deployer / intended upgrade authority:
  `ATJeSsM6kshKaTp4MVipQaTksNpEdAvkYkc7ofY1rU9V`.
- Remaining deployer balance after verified demo: 0.41962504 free Devnet SOL.
- Deployment buffer (consumed by finalization; its local keypair is retained): `AQRxVer3WRTRdmRCiuimBtVCv6dQCA5W4rpB5pdhRY1x`.
- Private paths: `.local/program-keypair.json`,
  `.local/devnet-deployer.wallet.json`, `.local/devnet-buffer.wallet.json`.
- Initial native CLI uploads stalled; the pinned CLI's UDP path ignored the
  HTTP-only option. Parallel RPC uploads then exhausted retries. The deployment
  command now writes sequentially into the retained buffer, skips matching bytes,
  backs off on throttling and verifies the complete ELF before finalization.
- Program-data rent quote: 1,539,102,840 test lamports. This is separate from
  task-token allowances. Existing buffer funding is reused, not deposited again.

For verification/recovery, run `npm run devnet:plan`, inspect program/buffer state, then use
`npm run devnet:deploy`. Do not fund a new buffer blindly or assume a timeout
means failure. The command will not automatically upgrade an existing program
whose binary or authority differs from this checkpoint. No real SOL or paid RPC
is authorized. The public deployment JSON is the authority for success.

## Remaining release work

Devnet deployment and its test-token workflow are complete.
Only with fresh explicit cost authorization and securely configured
credentials, exercise the actual OpenAI adapter in a bounded full workflow.
The user has not yet authorized that action.

Next product work: real-browser/mobile/accessibility checks, secure interactive
wallet onboarding, hosted web/gateway/worker/database, backup/restore, supervised
scheduling, bounded demo costs, pagination, retention, monitoring, production
login and credential recovery, database least privilege and security review.
The current developer owner-key console and operator wallets are trusted
infrastructure, not a public multi-user custody product. x402 compatibility is
still unverified; this is a direct vault-backed self-operated service.
