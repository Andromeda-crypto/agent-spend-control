# HTTP and TypeScript integration

The development gateway uses independent owner and agent bearer credentials.
Generate an owner token with a cryptographic RNG (32 random bytes encoded as
base64url), retain it in a secret store, and use it to create tasks. Reusing
that owner token reuses the workspace. The returned agent token is scoped to
one task. Only hashes are stored. This is a developer bootstrap, not an
interactive account/login system. Use TLS when hosting it.

Do not paste credentials into chat or commit them. Keep owner credentials out
of agent context. Agent credentials cannot approve, edit policy or revoke.
The worker uses a trusted database connection, not agent authorization.

## Routes

| Method | Path | Credential | Behavior |
|---|---|---|---|
| GET | /health | none | process liveness |
| POST | /tasks | owner bootstrap | create task and return agent token once |
| GET | /tasks/:task | owner or task agent | policy, totals, requests, usage, timeline |
| POST | /tasks/:task/requests | task agent | reserve or request approval |
| POST | /tasks/:task/requests/:id/approve | owner | approve exact payload and version |
| PATCH | /tasks/:task/policy | owner | version-checked policy replacement |
| POST | /tasks/:task/pause | owner | cancel pending work and pause |
| POST | /tasks/:task/resume | owner | allow new submissions after pause |
| POST | /tasks/:task/revoke | owner | cancel pending work and permanently revoke |

Request, policy and response schemas live in `packages/policy` and
`packages/sdk/src/contracts.ts`. Requests accept at most 64 KiB. Validation
failures return 400; authorization failures 403; absent routes 404; policy,
limit and idempotency conflicts 409. Unexpected failures return a generic 500.
Server errors do not disclose SQL or raw validation payloads.

POST /tasks body:

```json
{"budget":"100","perRequest":"40","approvalAbove":"10","calls":5,"expiresAt":"2026-11-09T00:00:00Z","providers":["fixture"],"tools":["search"],"recipients":["service"]}
```

POST /tasks/:task/requests requires `Idempotency-Key` and this body:

```json
{"provider":"fixture","tool":"search","recipient":"service","amount":"20","input":{"query":"Solana research"}}
```

The amount is the requested reservation, verified against the trusted adapter's
quote before dispatch. It is not a trusted agent-reported provider cost.
Monetary units are integer strings. Idempotency keys are scoped to the task and
bound to the complete parsed payload, including input. Exact retries return
the current request state even after revocation; they do not execute again.
Changed-payload retries fail. Unknown top-level fields are rejected.

Approve/pause/resume/revoke accept an empty object. Policy replacement body is
`{"expectedVersion":1,"policy":{...}}`. Replacement increments the version and
cancels all pending approvals/reservations. It cannot reduce budgets or quotas
below already committed usage. Resume permits new requests; it does not
resurrect cancelled requests. Revocation cannot be undone.

## TypeScript SDK

The SDK is source-local for now; it is not published to npm. From an example
in this repository:

```ts
import { SpendingClient } from '../packages/sdk/src/index.js';

const owner = new SpendingClient('http://127.0.0.1:3001', process.env.OWNER_TOKEN!);
const { task, agent: token } = await owner.createTask({
  budget: '100', perRequest: '40', approvalAbove: '10', calls: 5,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  providers: ['fixture'], tools: ['search'], recipients: ['service'],
});
const agent = new SpendingClient('http://127.0.0.1:3001', token);
const request = await agent.submit(task, 'research-1', {
  provider: 'fixture', tool: 'search', recipient: 'service', amount: '20',
  input: { query: 'Solana research' },
});
// Owner-side code only; never give the agent this client or credential.
await owner.approve(task, request.id);
// Operator runs ENABLE_FIXTURE_ADAPTER=true npm run worker:once.
const report = await owner.snapshot(task);
```

Plain HTTP submission (TASK_ID, AGENT_TOKEN and OWNER_TOKEN configured locally):

```sh
curl -sS "http://127.0.0.1:3001/tasks/$TASK_ID/requests" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: research-1' \
  --data '{"provider":"fixture","tool":"search","recipient":"service","amount":"20","input":{"query":"Solana research"}}'
```

## Synthetic failure exercises

The fixture input accepts `simulateTimeout: true` and `failDelivery: true`.
The former persists the synthetic provider receipt and then loses the response;
the next worker pass looks it up without sending the purchase again. The
latter confirms a synthetic charge while recording failed delivery. These
options are fixture-only. They do not simulate a real on-chain transaction.

## Identity and dashboard additions

`POST /owners` accepts `{"name":"Research workspace"}` and returns an owner ID,
workspace ID, name and one-time owner credential. `GET /identity` lists that
owner's task agents. `POST /identity/rotate` returns a replacement owner
credential and immediately revokes the previous credential; replaying the old
credential cannot bootstrap access to the old workspace.

`POST /tasks/:task/agent/rotate` replaces the agent credential. The owner-only
`POST /tasks/:task/agent/revoke` revokes that agent and its task. Owner authority
and task-agent authority are stored in explicit identity/credential records.

All routes are also reachable under `/api`, used by the Vite dashboard proxy.
Authenticated `GET /capabilities` reports configuration booleans only, never
secret values. `POST /tasks/:task/research` accepts
`{"topic":"Safe spending on Solana","mode":"fixture"}` and starts the durable
four-step reference workflow. Live mode requires explicit operator enablement
and unfinished vault/service provisioning; it is not a verified release flow.

Policies now include an `asset` object (`kind`, `network`, `mint`, `symbol`,
`decimals`) and `maxOutputTokens`. Omitted fields default to fixture units and
512 output tokens. Asset identity cannot be changed by policy replacement.
Policies attached to an on-chain vault cannot be edited in place; create a new
vault instead. OpenAI calls reserve zero token-payment units, consume the call
quota, and are bounded by the configured output-token maximum. Their provider
billing is separate and is not a confirmed dollar amount in the usage ledger.

Snapshots now include `research` runs and an optional `vault` binding. Revoked
gateway authority and confirmed on-chain revocation are distinct fields.

## Verified task-to-vault binding

`POST /tasks/:task/vault` is owner-only and accepts:

```json
{"policy":"PROGRAM_POLICY_PDA","owner":"OWNER_WALLET_PUBLIC_KEY","recipientAccount":"SERVICE_TOKEN_ACCOUNT","signature":"BASE64_ED25519_SIGNATURE"}
```

The signature covers the domain-separated binding message implemented in
`packages/solana/binding.ts`: workspace/task identity, current policy hash/version,
program, cluster, policy/vault addresses, mint, recipient token account and agent.
The gateway checks its trusted public configuration and the actual on-chain
policy, PDA seeds, limits, expiry, mint decimals, account authority and funding.
RPC inspection runs outside transactions; the final binding revalidates the owner
and policy under the task lock. Exact retries return the binding without creating
or funding another vault, including after legitimate spending.

The operator command `npm run vault:provision -- TASK_ID` reads OWNER_TOKEN and
OWNER_WALLET_PATH securely from the environment or ignored `.env.local`.
It creates and deposits in one atomic chain transaction, persists its signed
transaction before broadcast, and only rebroadcasts that same transaction on
retry. It never puts the owner key in the SDK or model context. A signed
provisioning plan freezes that task's policy to avoid ambiguous funding under
changed limits. Expired/unresolved provisioning needs operator investigation;
it is not automatically replaced with another payment.

Research modes are now `fixture` (all synthetic), `local` (local-validator token
transfers and simulated model), `devnet-demo` (actual Devnet transfers and simulated
model), and `live` (actual OpenAI, explicitly operator-enabled). Local and Devnet
demo modes require matching verified vault bindings. Only one active research run
is allowed per task. The SDK exposes `startResearch` and `bindVault` helpers.

Devnet receipt reconciliation requires finality and matches the actual transaction
signature/accounts against the program receipt. Usage distinguishes token amount,
service delivery, transaction fee lamports and receipt-account rent. Neither SOL
fees nor provider-dollar billing are silently deducted from the token allowance.
