# Status — 2026-11-08

## MLH submission in progress — November 8

DevRelay installed and MLH connected; participant is checked in to Solana Hackathon.
No MLH project/submission has been created yet: the event requires seven personal
experience survey answers that are awaiting the user. User confirmed beginner
eligibility and has no YouTube/Vimeo/Loom video URL. Prepared categories: Overall,
Beginner, DeFi and AI (with explicit simulated-model disclosure); Gaming skipped.
The hosted MP4 will be included as an extra link, not misrepresented as a supported
video-platform URL. If MLH requires a supported host, report that blocker.

The original recording now names **Solana Hackathon** in its opening banner; no
workflow was rerun. Updated public video playback, captions, static-only traffic,
responsive layouts and exact bytes are verified. PR #4 carries this correction.
Resume from the prepared ignored `.local/mlh-submission-draft.json`, obtain the
required survey answers and submit through DevRelay before 1:00 PM EST. Do not
invent ratings/feedback or claim submission success without MLH confirmation.

## Resume here

The agreed hackathon deliverable is a bounded **one-agent / one-paid-tool developer
preview**, with a polished public Orbit replay and working recording. Do not
expand scope before submission. No external customer adoption is claimed.

**Submit:** https://agent-spend-control-replay.vercel.app/submission.html

**Interactive replay:** https://agent-spend-control-replay.vercel.app

**Repository:** https://github.com/Andromeda-crypto/agent-spend-control

[Submission brief](SUBMISSION.md) includes the pitch, architecture diagram,
evidence and explicit simulation boundaries. [PR #3](https://github.com/Andromeda-crypto/agent-spend-control/pull/3)
carries this package; GitHub records its check/merge status. Earlier development
and Orbit histories were integrated through PRs #1 and #2. Preserve branch refs.

Public deployment: `dpl_Xf6fbeo1Sp1uDHWwRu8Y9f8WjUzy`.
Deployed source: `a94f448648ae458ca3c36672c8e109cd9655ba1c`.
[Release record](deployments/public-replay.json) has verification and file hashes.
This is a manual static deployment; pushing Git does not auto-publish.

## Implemented

- Owner/agent identity, rotations, tenant isolation, payload-bound idempotency,
  PostgreSQL task locking, durable requests/events/reservations and usage ledger.
- Exact owner approval bound to purchase hash and policy version. Approval cannot
  override hard caps. Pause/revoke stops new work; dispatched work is reconciled.
- Worker/watch execution, persisted signed attempts, conservative reconciliation,
  independent payment/delivery outcomes and separate owner-signing process.
- Anchor token vault with mint/recipient, total/per-payment, expiry, exact
  exception and revocation restrictions; existing verified Devnet deployment.
- Internal research workflow uses shared `submitReference`; external clients use
  scoped `referenceTool` and bounded SDK waiting. No HTTP/polling under DB locks.
- Private Orbit Overview/Integration console: task data, approvals, receipts,
  reports, setup, keyboard focus preservation and connection recovery.
- Separate public static replay, seven phases and recorded finalized Devnet
  evidence. No private runtime, API proxy, wallet or signing code is published.
- Public submission page: pitch, architecture overview, source/evidence links,
  37.5-second silent time-compressed working recording, captions and permanent
  local-validator/self-operated TEST/simulated-model disclosure. Sign-in excluded.
- Professional README, integration guide, fresh-task rehearsal, presenter script
  and [independent developer handoff](PILOT_HANDOFF.md). Stale architecture,
  hosting and CI claims reconciled.
- Portable private/public container configuration and per-role environment
  examples. Docker runtime remains unverified, not a production distribution.

## Verified

- TypeScript, both production builds and 14 Node tests pass in this increment.
  Earlier combined PostgreSQL/local-Solana suite passed 16 tests. GitHub CI runs
  PostgreSQL/HTTP checks as well as types, unit tests, terminal demo and builds.
- Fresh standalone client rehearsal: separate Node processes, actual local basic
  20 TEST and premium 40 TEST deliveries, exact owner approval, restarted-client
  same-request/no-duplicate-charge check, desktop/mobile and no rendered secrets.
- Separate fresh research task: allowed request → exact premium approval → local
  payment/delivery → simulated report → confirmed local revocation → replay
  blocked-request illustration/final report. Original recorded frames reviewed.
- Earlier full Chrome lifecycle also covers masked sign-in/error, modal/keyboard
  focus, offline recovery, refresh and retained open receipt details.
- Production and anonymous hosted Chrome checks: HTTPS, restrictive headers,
  seven phase links/refresh, submission direct navigation/refresh, video playback
  and loaded captions, 1440/375/320px, Devnet links, no console/JS errors and no
  privileged traffic. All eight served assets match the nine-file audited package
  (including Vercel header config). Private/API paths return 404.
- Hosted checking caught a missing favicon; fixed and verified. Initial video
  encoding lacked drawtext; original successful-run frames were retained and
  encoded with a code-rendered permanent banner, without repeating payments.
- Details: [BROWSER_QA.md](BROWSER_QA.md), [REHEARSAL.md](REHEARSAL.md),
  [rehearsal evidence](deployments/rehearsal.json).

## Independent developer gate

No independent developer is currently available. User explicitly selected
**prepare handoff**. The separate-process repository integration is verified;
it is not an independent human adoption. The acceptance protocol is ready in
[PILOT_HANDOFF.md](PILOT_HANDOFF.md). Mark this gate unverified until actual
external feedback exists. No external pilot repository has been selected.

## Preserved state and execution boundaries

Existing Devnet program: `8A12uxD8G5fpV1tAJja61EB7fhUwksmaDwjGB9uqqGe6`.
Authority: `ATJeSsM6kshKaTp4MVipQaTksNpEdAvkYkc7ofY1rU9V`.
[Deployment](deployments/devnet.json) and [two finalized payments](deployments/devnet-workflow.json)
are unchanged. No redeploy, upgrade, replacement buffer or new Devnet transaction
was made for this package. No billable OpenAI call was made or authorized.
TEST token/reference service are self-operated; model output remains simulated.
Token budgets do not cap provider dollar billing or SOL fees/rent. No x402 claim.

Only the rehearsal's owned local processes were stopped, gracefully after ledger
finality. Databases, validator ledger, private wallets/access files and prior
receipts remain intact under ignored `.local/`. The latest local task completed
and is revoked; use a fresh task for another execution. Earlier standalone-client
tasks and their receipts are retained. No state reset occurred.

## Next action / reproduce

Share the submission link and repository, then rehearse the three-minute verbal
pitch with the recording/replay fallback. If a developer becomes available, run
the independent handoff. Further use cases and broad onboarding are deferred.

Wallet-free replay: `npm ci` then `npm run replay:dev`.

Private working flow (PostgreSQL 17 and existing Solana toolchain/build):

```sh
PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run local:demo -- --new-task
# In another terminal, choose one check for the fresh task:
npm run test:agent-browser
# OR full research workflow (revokes its task):
npm run test:browser
# OR credential-free recorded research workflow (Chrome + ffmpeg):
node scripts/record-walkthrough.mjs
```

Stop the launcher with Ctrl+C and **wait until it exits** before starting a new
stack/task. Do not seed to clear uncertainty; preserve and reconcile it.
See [LOCAL_DEMO.md](LOCAL_DEMO.md) and [REHEARSAL.md](REHEARSAL.md).
Existing Devnet execution remains operator-controlled; do not run `devnet:deploy`
merely to resume. Never publish the privileged console or repository root.

## Remaining beyond hackathon scope

Independent developer feedback; production login/recovery; isolated public live
sessions; independent signing review/security audit; DB least privilege;
monitoring, rate limits and supervised deployment; pagination/retention and
operator recovery tools. Docker runtime, signer mount permissions, private tunnel
isolation and backup/restore still need verification before hosting private state.
Native mobile/Safari and screen-reader review remain. SDK is source-local;
additional paid tools require trusted adapters and verified provider semantics.
Actual OpenAI adapter is mock-tested only until new explicit spending approval.
