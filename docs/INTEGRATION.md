# Integrating one existing agent

The first adoption milestone is one developer integrating one governed paid tool
into an agent they already run. Keep their framework, model and other tools.
Do not build public self-service onboarding before validating this integration.
The public replay explains the product; it is not an API endpoint.

## Responsibility split

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
