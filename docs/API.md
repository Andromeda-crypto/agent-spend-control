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
