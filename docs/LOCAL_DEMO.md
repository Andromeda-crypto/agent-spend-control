# Run the complete test-cluster workflow

No OpenAI key is needed and the launcher explicitly disables OpenAI execution.
The model response is a labeled simulation. Token transfers, program restrictions,
service delivery proofs, fees and receipts come from the selected actual test cluster.

## Local validator

Install Node >=22.12, PostgreSQL 17 binaries and the Solana CLI. Then:

```sh
npm ci
npm run vault:build
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run local:demo
```

Omit PG_BIN if PostgreSQL binaries are already on PATH. SOLANA_BIN can select a
nonstandard CLI installation. The launcher starts its own PostgreSQL cluster,
validator, gateway, paid service, agent worker, owner synchronizer and Vite UI.
All listeners bind to localhost. It stops the processes it started on Ctrl+C;
it retains the local database and ledger for the next launch.

Open the printed dashboard URL (normally http://127.0.0.1:5174), choose owner-key sign-in, and copy the owner token
from `.local/local-demo-v2/access.json` into that local screen. Do not paste it
into chat. Select the provisioned TEST task and choose **Run research** under
Developer access & policy. The premium 40-unit purchase pauses for approval.
Approve it in the inbox and watch the report and itemized receipts appear.

Expected first-run totals: 60 TEST spent, 0 reserved, 60 allowance remaining,
and 8 calls left. The two model calls are simulated; the 20- and 40-unit
payments are actual local-validator SPL transfers. Transaction fees and receipt
account rent are shown in SOL lamports separately from the TEST allowance.

For an automatic verification pass that starts and stops the stack:

```sh
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run local:demo -- --smoke
```

A smoke run creates a new task under the same local owner when one exists.
`--new-task` creates a fresh allowance on a later interactive launch while
preserving old tasks and receipts. This is local test data, not real funds.

The persistent ledger is tied to the compiled program hash. If the binary changes,
preserve the old `.local/local-demo-v2` directory under another name before starting
a fresh demo. Do not silently run an old ledger against a different build.

## Devnet

First inspect `docs/deployments/devnet.json`, when present, for the verified
program and upgrade authority. The original deployment requires the matching
local program keypair, plus free Devnet SOL in the dedicated deployer wallet.

```sh
npm run devnet:plan
npm run devnet:deploy
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run devnet:demo
```

The demo command uses the already deployed program. It creates a self-operated
TEST mint, funds a restricted agent fee wallet with 0.03 test SOL if needed,
creates/funds a task vault, and starts the local gateway, service and dashboard.
It does not start a validator or call the Devnet faucet repeatedly. All network
fees and rent use free Devnet SOL; no real SOL or paid RPC is required.

Sign in with `.local/devnet-demo/access.json`. Start the provisioned task and
approve its premium purchase as in local mode. The dashboard says DEVNET and
SIMULATED MODEL; confirmed payments link to the actual Devnet explorer.
OpenAI is disabled even if an API key happens to exist in the launch environment.

```sh
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run devnet:demo -- --smoke
```

A successful Devnet smoke pass writes public chain evidence to
`docs/deployments/devnet-workflow.json`. It does not record credentials or private
key material. Public RPC throttling or finality delays can leave work pending;
restart against the same state and reconcile rather than paying again.

## Credentials and process boundaries

Keys and access credentials live only under ignored `.local/` with restrictive
file permissions. The agent process receives the agent signer path, not the
owner signer. The separate owner process observes authenticated approval rows
and signs only matching exceptions/revocations. The gateway and service receive
public Solana configuration. This is a trusted single-operator developer setup,
not an OS sandbox or a public multi-user custody service.

Owner credential rotation intentionally invalidates the saved old token. Update
your private access configuration with the replacement key; do not bypass the
revocation by resetting account state.
