# One developer, one agent, one paid tool

This is the independent-developer handoff. An external developer has not yet
completed it. The separate-process repository client is a verified integration
check, not evidence of independent adoption.

## Scope and roles

Developer: keep your agent framework/model; replace one tool call with the
source-local `referenceTool`. Persist one operation ID per intended purchase.
Operator: provision one isolated bounded TEST task, provide its scoped credential
privately and approve only the exact premium purchase. Keep the owner credential,
wallet, database and signer inaccessible to the developer and model.

This pilot uses the existing self-operated reference service: basic 20 TEST,
premium 40 TEST, allowance 120, per-request maximum 60, approval above 30.
No billable model call is required. A different service needs a trusted adapter
and verified payment/recovery semantics; changing a URL is insufficient.

## Acceptance procedure

1. Follow [INTEGRATION.md](INTEGRATION.md) from a clean checkout. Record time and
   any undocumented dependency; do not send environment files or credentials.
2. Operator seeds a new task using the existing local deployment. Supply only
   `SPEND_GATEWAY_URL`, `SPEND_TASK_ID`, `SPEND_AGENT_TOKEN` privately. An external
   machine needs an operator-approved private tunnel; the public replay URL is
   not a gateway. Never expose the console anonymously.
3. Run the basic tool with a persisted `AGENT_OPERATION_ID`. Expect one 20 TEST
   charge and delivered reference data.
4. Run premium with another operation ID. Before owner approval, verify it waits
   and does not pay. Operator checks exact amount/recipient/policy, approves once,
   then both sides verify 40 TEST charged and delivery independently recorded.
5. Restart the client with the original basic ID/input. Expect the same request
   and no new charge. Reuse that ID with changed input: expect a conflict.
6. Use a separate operation ID to submit an over-cap 61 TEST reference intent via
   `SpendingClient.submit`. Expect rejection and no new payment. Do not change
   `referenceTool`'s fixed trusted prices to manufacture a provider quote.
7. Operator revokes the task and waits for chain confirmation. A fresh request
   must fail. Prior receipts remain. Do not seed/refresh to resolve uncertainty.

Return only: commit, platform, framework, elapsed integration time, safe request
IDs, observed charge/delivery outcomes, restart/conflict/block/revoke results,
confusing instructions and pass/fail. No tokens, wallet files, traces, HAR or
unredacted environment logs. Success means the developer completes this without
implementation help beyond scoped configuration and owner approval.

## Reproducible integration check available now

On a running fresh local task:

```sh
npm run test:agent-browser
```

This runs `examples/existing-agent/main.ts` in separate Node processes with only
task-scoped configuration, using the actual gateway, local token transfer and
reference service. Chrome handles private owner approval and inspects receipts.
It verifies basic/premium delivery, same-job restart returning the original
request, desktop/mobile layout and absence of rendered credentials. It does not
replace the human acceptance procedure above or prove an arbitrary third-party
service is compatible.
