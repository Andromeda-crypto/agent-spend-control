# Integrating one existing agent

The first internal pilot is the existing research agent in this repository.
The next adoption milestone is one developer integrating a governed paid tool
into an agent they already run. Keep their framework, model and other tools.
Do not build public self-service onboarding before validating this integration.
The public replay explains the product; it is not an API endpoint.

## External-agent responsibility split

| Operator | Existing agent process |
|---|---|
| Creates policy and provisions/funds the task vault | Holds only the task ID, gateway URL and scoped agent credential |
| Runs gateway, worker, reference service and owner synchronizer | Submits supported tool purchases with persistent operation IDs |
| Reviews exact approvals and can pause/revoke | Waits for outcomes and handles pending/failed delivery |
| Holds owner credential, signer and DB configuration | Never receives the owner signer, owner token or DB connection |

The agent's call submits a purchase intent. A trusted worker executes it; the
wrapper must not also call a provider/payment endpoint itself. Other agent tools
remain outside these controls. The current reference integration requires the
supported `solana/reference/reference-service` adapter; arbitrary endpoints and
services are not automatically supported.

## Private local pilot

1. Follow [LOCAL_DEMO.md](LOCAL_DEMO.md), then run
   `PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run local:demo -- --new-task`.
   This uses the retained local validator and seeds a bounded task. It does not
   deploy to Devnet or call OpenAI.
2. Sign into the private console and select **Integration**. Choose the new funded
   task. Leave its built-in research workflow idle: the existing agent will submit
   its own requests instead.
3. The operator privately supplies `SPEND_GATEWAY_URL`, `SPEND_TASK_ID`, and
   `SPEND_AGENT_TOKEN`. For the standard local launcher the gateway usually uses
   port 3101; use the actual configured port. It differs from the Vite console
   port. The operator can obtain the agent credential from the ignored local
   access file without displaying it or copying the owner credential.
4. Copy `examples/existing-agent/agent.env.example` to ignored `.env.agent.local`.
   Persist `AGENT_OPERATION_ID` with the agent job. Run
   `npm run agent:reference -- basic`; inspect its receipt and the console.
5. Use a distinct operation ID for `premium`. With the default policy, it pauses
   for a 40 TEST approval. Review the exact purchase in **Approvals**. The owner
   synchronizer and worker resume it. The agent never approves its own purchase.

For framework integration, mount the exported `referenceTool` function as one
of the existing agent's tools. Its inputs are `operationId`, `dataset` and `topic`.
Use the returned receipt only after checking delivery. Import paths in examples
assume this repository; SDK package publication is not implemented yet. A first
external adopter can run this example checkout alongside their agent, or vendor
the SDK plus its policy/schema dependencies. Do not imply an npm install exists.

## Waiting, retrying and failed delivery

`client.waitForRequest(task, requestId, options)` polls the authenticated snapshot.
Defaults: 60 seconds and 1-second polling. `onApproval` notifies the caller once
per wait invocation; it does not grant approval. A caller-provided `signal` stops
waiting and is propagated to reads. Stopping a wait does not cancel remote work.

`PendingRequestError` contains the request ID when the waiting deadline expires.
Resume waiting for that ID, or call the wrapper with the same stable operation ID
and **identical** input. The server binds idempotency to the complete payload.
Changed input with the same key fails rather than creating a second payment.
An initial submission network failure is uncertain: retry the same key/payload,
not a new operation ID. Do not turn connection trouble into another purchase.

The result contains the request and settled usage, if any. `succeeded`, `failed`
and `cancelled` are terminal execution states. A failed request may still have a
confirmed charge and `delivery: failed`. Reserved/dispatched work remains uncertain
until reconciled. Never infer “no payment” merely from an HTTP error or timeout.
Policy errors such as `hard_limit`, `not_allowed` and `task_inactive` are not
instructions to rotate keys, widen policy or create another task automatically.

## Pilot acceptance criteria

- Developer adds the wrapper to an existing agent without moving owner authority
  into it or replacing its framework.
- Basic purchase completes; premium pauses and resumes through exact owner approval.
- Restart/retry with the same job ID creates no second payment; changed-payload
  retries and over-limit requests are rejected.
- Console shows requests, charges and delivery independently; owner revocation
  blocks new work.
- Record developer feedback, setup friction, integration changes required and
  time to the first receipt. Automated examples are groundwork, not evidence
  that an external adopter has completed the pilot.

Keep the first pilot private and local/test-token only. Moving it to Devnet uses
the existing program and explicit bounded tasks; it does not require redeploying.
No billable model calls, public live execution or x402 compatibility are enabled.

## Verification

`npm run test:integration` includes an independent tool-client scenario against
actual local SPL transfers: waiting timeout, same-key recovery, exact premium
approval, agent/owner authorization separation, changed-input conflicts, hard
caps and exactly two chain attempts. No model API is called.

With a newly provisioned local task and the demo running,
`npm run test:agent-browser` runs the CLI in an independent process, observes
requests in Integration, approves premium through the browser and checks both
deliveries and a no-second-payment retry. It uses installed Chrome and stores
credential-free screenshots in ignored `.local/qa`. Tests use only local test
tokens. A real outside developer adoption pilot is still the next step.

## First internal pilot: existing research agent

The selected agent is `advanceResearch` in
`examples/reference-agent/workflow.ts`, invoked by `apps/worker/src/runtime.ts`.
For `local` / `devnet-demo` research, both the basic and premium service steps now
call `submitReference` from `packages/sdk/src/reference-tool.ts`. The premium
request remains `solana / reference / reference-service`, amount `40`, with the
same `{dataset: 'premium', topic}` input. Its key remains
`research:<run-id>:2`, so existing retries, exact approvals, chain scope and the
report's `research:<run-id>:%` evidence query keep their original identities.
Fixture research remains explicitly synthetic and does not call the TEST service.

This agent already runs inside trusted worker infrastructure with a transaction-
bound store. Its submission port delegates to `Store.reserveTrusted`; it does not
use a task bearer credential internally. Only submission occurs inside the row
lock. No HTTP request, service execution or polling is introduced there. The
existing worker executes/reconciles, the owner process handles approved chain
exceptions, and subsequent durable ticks resume the research. This preserves the
existing trust boundary; it is not proof of an external agent's authentication.

The external `referenceTool` wrapper calls that same `submitReference` function
through `SpendingClient.submit`, then waits outside any server transaction. Its
agent bearer is checked by the HTTP gateway. Never copy the internal trusted DB
port into an untrusted agent process.

Run the internal pilot on a new task with `local:demo -- --new-task`. In the
private console, start research, observe the basic payment, review/approve the
premium purchase, and read the simulated report and separate delivery/charge
receipts. Do not also run the standalone agent on that task during the pilot.

### Actual implementation paths

| Path | Role |
|---|---|
| `examples/reference-agent/workflow.ts` | Existing durable research agent; shared submission at basic/premium steps |
| `packages/sdk/src/reference-tool.ts` | Strict input, fixed reference pricing/payload, shared submission and external waiter wrapper |
| `packages/sdk/src/index.ts` | HTTP client, scoped SDK operations, pending/deadline/cancellation behavior and exports |
| `apps/gateway/src/store.ts` | Task lock, reservations, exact idempotency and approval/budget enforcement |
| `apps/worker/src/runtime.ts` | Invokes workflow and execution/reconciliation passes |
| `packages/adapters/solana.ts` | Restricted payment and independently recorded service-delivery outcome |
| `apps/reference-service/src/service.ts` | Self-operated TEST reference service and delivery-proof validation |
| `apps/web/src/integration.ts` | Private integration setup, limits and observed outcomes |
| `test/fullstack/flow.test.ts` | Actual internal research workflow and external-style client integration assertions |

### Minimum changes for another developer

For an agent using **this reference service**, import `SpendingClient` and
`referenceTool` from the source-local SDK, provide its scoped URL/task/token, and
replace one tool call with the wrapper. Persist an operation ID per actual
purchase; handle approval/pending and inspect delivery before consuming evidence.
No owner wallet, DB credential, framework migration or new model call is needed.
The example re-export at `examples/existing-agent/reference-tool.ts` remains for
existing imports. The SDK is not published to npm.

For a **different paid tool**, replacing a URL is insufficient:

1. Define and validate its payload, provider/tool/recipient identity, price units
   and durable operation scope; adapt a tool-specific SDK wrapper.
2. Implement a trusted adapter's `quote`, `execute` and `lookup` under
   `packages/adapters`, including durable payment/provider receipts and separate
   delivery outcome. Wire it in `apps/worker/src/runtime.ts`.
3. Add explicit gateway execution gating in `apps/gateway/src/app.ts`, create a
   compatible bounded policy, and provision any required owner-signed binding.
   Keep new billable adapters disabled until separately authorized. Do not bypass
   the current live-execution gate or widen an existing vault policy silently.
4. Prove retry/restart, approval/hash/version binding, hard caps, reconciliation
   and paid-but-failed delivery against that actual provider in integration tests.

Remaining assumptions: fixed 20/40 TEST prices for the self-operated service;
a funded, compatible task; working private worker/owner signer; trusted operator
DB; source-local SDK; and a provider capable of payment proof/idempotent lookup.
External services may not accept this vault-backed payment scheme. There is no
x402 claim, universal HTTP/payment proxy or provider-dollar cap. The model stays
simulated and billable API calls stay disabled. An external customer pilot is
still unverified even after the internal research pilot succeeds.
