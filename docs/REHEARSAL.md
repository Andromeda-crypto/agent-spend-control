# Hackathon rehearsal and integration evidence

## Scope

Recorded working flow: private local validator, actual self-operated TEST
transfers and reference delivery, simulated model. Separate public evidence:
two previously finalized Devnet transfers. No new Devnet deployment or
transaction and no billable OpenAI call are required for rehearsal.

## Reproduce the two checks

1. Start the preserved stack with a fresh task:
   `PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run local:demo -- --new-task`.
2. In another terminal run `npm run test:agent-browser`. It launches the
   standalone agent client in separate processes using scoped credentials;
   Chrome handles owner approval and verifies receipts. It spends 60 TEST and
   verifies a restarted basic call returns the same request without another charge.
3. Gracefully stop the launcher with Ctrl+C and **wait until it exits**. Do not
   start another PostgreSQL/validator while shutdown/finality is in progress.
   Restart with `--new-task`, preserving all earlier tasks, DB and ledger.
4. Run `node scripts/record-walkthrough.mjs`. Requires installed Chrome and
   `ffmpeg` with libx264; set `CHROME_PATH` if needed. The script signs in
   without recording, then records only authenticated credential-free frames.
   It exercises research, exact approval, settled payments/delivery, report,
   confirmed revocation and the public replay fallback. It asserts credentials
   are absent from rendered text and records no sign-in, traces, HAR or API bodies.
5. Inspect the private output under `.local/recordings/<timestamp>/`: MP4, captions
   and recording manifest. Publish only the reviewed video/captions, never frames,
   access files, wallets or the recording directory. Frame sampling produces a
   time-compressed recording; captions describe actual milestones, not live Devnet.
6. Repeat public artifact and hosted browser checks. If execution is interrupted,
   preserve the task and investigate reconciliation. Never seed to clear an
   uncertain payment.

## Independent developer acceptance

The separate-process client proves the integration boundary, not an independent
human adoption. [PILOT_HANDOFF.md](PILOT_HANDOFF.md) supplies that separate gate.
No third-party developer result or customer adoption is claimed.

## Verified run — 2026-11-07

- Standalone agent process: basic 20 TEST and premium 40 TEST delivered; premium
  owner approval, restart/same-ID no duplicate charge, desktop/mobile checks passed.
- A separate fresh task completed the recorded research → exact approval → local
  payment/delivery → simulated report → confirmed local revocation → replay fallback.
- The public MP4 is 37.5 seconds, silent and time-compressed, with captions and a
  permanent local-validator/simulated-model disclosure. Original credential-free
  frames and the private manifest remain ignored under `.local/recordings/`.
- The first encoding attempt failed because installed ffmpeg lacks drawtext. The
  original successful run was preserved and encoded using a code-rendered banner;
  no payments were repeated to recover the video.
- No independent external developer is available; user selected prepared handoff.
  Acceptance remains explicitly unverified.
