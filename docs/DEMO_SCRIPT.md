# Three-minute demonstration

Submission brief: [SUBMISSION.md](SUBMISSION.md). Working recording and captions
are on the [public submission page](https://agent-spend-control-replay.vercel.app/submission.html).
The 37.5-second silent recording is time-compressed local execution, not Devnet.
[Reproduce the recording and separate-client rehearsal](REHEARSAL.md).

Use the public read-only replay for an external audience. Use the private local
or Devnet console only while supervised by the operator. Model output is always
labeled **simulated**. TEST token and paid reference service are self-operated.
No x402 support claim is made.

## Presenter script

1. **Allowance (20s).** “This task has 120 TEST. Available is what it can still
   spend; reserved covers queued or uncertain execution; spent is confirmed
   consumption. The per-request cap is 60 and the approval threshold is 30.”
2. **Allowed request (25s).** Start research on the selected funded task.
   “The 20 TEST basic reference fits the policy. The model steps are simulated;
   the reference payment is an actual transfer on the selected test cluster.”
3. **Approval (30s).** Wait for the premium 40 TEST reference. Show amount,
   service/recipient and policy version. “This exact purchase needs approval.
   Approval cannot bypass a hard cap.” Approve once and wait for reconciliation.
4. **Payment and delivery (25s).** Show “Payment confirmed” and “Delivery
   complete” separately. Expand a signature/explorer link only if asked.
   “If delivery failed after payment, this would still be spent.”
5. **Blocked request (20s).** In the public replay select “A blocked request.”
   “61 exceeds the 60 TEST cap. This is a labeled illustration of a restriction
   verified in local program tests, not a fresh Devnet transaction.” Do not
   imply the replay sends a request or use operator credentials in an audience tool.
6. **Revocation (25s).** In the private console revoke the task, confirm the
   dialog, wait for “Revocation confirmed.” “Gateway authority stops immediately;
   we separately observe the chain. Previous payments remain recorded.” The
   replay version is explicitly illustrated, not Devnet revocation evidence.
7. **Final report (20s).** “The two references were delivered; 60 TEST is spent.
   This report is simulated. Receipts are auditable. OpenAI billing is separate
   and remains disabled.”

The replay can be used entirely offline after the local static host loads its
assets/evidence. Explorer links require internet. Never display the private
access file, owner key, wallet files, developer tools containing Authorization,
a credential download, terminal environment or sign-in password to an audience.

## Reliable setup / new-task procedure

Fresh developer: follow [LOCAL_DEMO.md](LOCAL_DEMO.md), install prerequisites,
run `npm ci`, compile the vault once with `npm run vault:build`, then:

```sh
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run local:demo -- --new-task
```

The launcher preserves DB/ledger and creates a bounded, funded task under the
saved owner. Use the private access file locally for masked sign-in. Select the
newest unused task; the task identifier is safe but credentials are not. Do not
refresh/seed to fix an uncertain payment. Watch its reserved state reconcile.
One run spends 60 TEST; one seeded allowance is 120. After revocation or expiry,
start a new task explicitly. Do not rotate credentials during a presentation.

For supervised Devnet use the existing deployment and state:

```sh
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run devnet:demo -- --new-task
```

This creates/funds another bounded TEST task using existing operator wallets.
It needs free test SOL for fees/rent and TEST inventory. It does **not** deploy
or upgrade. Avoid repeatedly running it on public RPC failure: preserve state,
inspect and reconcile. No OpenAI key or billable authorization is needed.

## Replay fallback / fresh external visitor

```sh
npm ci
npm run replay:dev
# Open the printed localhost URL (normally 5176).
# Portable artifact:
npm run replay:build
```

No database, wallet, owner key, toolchain or sign-in is needed. Select scenes
with mouse or keyboard; hash links preserve the scene on refresh. The replay
loads only `evidence.json`, which contains allowlisted public deployment/payment
fields. “Recorded Devnet payment evidence” substantiates the two transfers;
blocked/revocation scenes explicitly describe locally tested behavior. Use this
when RPC is slow, test SOL is unavailable, or private operator access is
inappropriate. See [HOSTING.md](HOSTING.md) for the isolated static deployment.
