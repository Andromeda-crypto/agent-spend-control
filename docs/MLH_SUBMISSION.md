# MLH submission — Solana Hackathon

Submitted as **Om Anand** on November 8, 2026. MLH confirmed the project at
**11:39 AM EST** and all four prize entries by **11:43 AM EST**, before the
1:00 PM EST deadline. These are submissions, not judging results or prize awards.

- [MLH Overall entry (MLH sign-in required)](https://www.mlh.com/challenges/01a1a6ef-1328-c2f4-f126-f0506a239a09/submissions/01a1bc0a-65e5-68a4-82ef-e0dc74020863)
- [Public demo](https://agent-spend-control-replay.vercel.app/submission.html)
- [YouTube recording](https://youtu.be/N3iYx9IKD7g)
- [Source repository](https://github.com/Andromeda-crypto/agent-spend-control)

## Project fields accepted

**Name:** Agent Spending Control

**One-line pitch:** Bounded spending for agents: Solana vault limits, exact owner approvals, and auditable payment and delivery.

**Technologies:** solana, rust, anchor, spl-token, typescript, nodejs, postgresql, vite, zod, playwright, vercel, vercel-ai-sdk, openai.

**AI used to build it:** `codex`, `coding:openai/gpt-6`.
OpenAI is listed as project technology because the adapter exists; its disabled
live-call state is explicitly disclosed. No runtime API belongs in ai_tools.

One existing real public replay screenshot was sent from
`docs/images/public-replay.png`. No other team member was added.

### Exact description

## What it does
Agent Spending Control gives an existing agent bounded authority to buy one paid tool without handing it an unrestricted owner wallet. Owners configure a task allowance, per-request cap, approved recipients, expiry and an approval threshold. Exceptions wait for approval bound to the exact purchase payload and policy version; approval cannot bypass hard limits.

## Working flow
A research task has 120 TEST, a 60 TEST per-request cap and approval above 30 TEST. The 20 TEST basic reference is allowed. The 40 TEST premium reference pauses for owner approval, then payment and delivery complete. Over-cap requests are blocked and revocation prevents new work. The report is explicitly simulated.

## How we built it
A TypeScript SDK/tool wrapper submits task-scoped requests to a private Node.js gateway. PostgreSQL locking, reservations, payload-bound idempotency, immutable approvals and a usage ledger make the lifecycle durable. A restricted worker persists signed attempts and reconciles uncertain outcomes rather than blindly paying again. An Anchor/Rust Solana SPL-token vault enforces spending limits, mint/recipient restrictions, expiry, exact exceptions and revocation. Owner signing runs separately. The Vite Orbit console exposes allowance, decisions, receipts and reports; a separate static replay is hosted on Vercel.

## Verification and evidence
Tests cover quota races, changed-payload retries, cross-workspace authority, exact approvals, recovery, vault restrictions and independent payment/delivery accounting. Fresh local-validator rehearsals verified actual 20/40 TEST transfers and reference delivery, owner approval, same-operation retry without duplicate payment and confirmed revocation. A separate-process agent client exercises the integration. Public links include two recorded finalized Devnet transactions and a 37.5-second captioned local working recording.

## Honest scope
TEST and the reference service are self-operated. Model output/report is simulated. An OpenAI Responses adapter using the Vercel AI SDK is implemented and mock-tested, but live model calls are disabled and no billable calls were made. Public pages are read-only; blocked/revocation replay phases are illustrations, not fresh Devnet transactions. No x402, mainnet-fund safety or independent external adoption is claimed. The owner signer trusts the operator database. Token allowances do not cap model-provider dollar billing or SOL fees/rent. Production authentication, public live-session isolation, independent security review and backup/restore validation remain future work.

### Extra links

- [Interactive Orbit replay](https://agent-spend-control-replay.vercel.app)
- [Working local-validator video (MP4)](https://agent-spend-control-replay.vercel.app/walkthrough.mp4)
- [Architecture and submission brief](https://github.com/Andromeda-crypto/agent-spend-control/blob/main/docs/SUBMISSION.md)
- [Devnet payment evidence](https://github.com/Andromeda-crypto/agent-spend-control/blob/main/docs/deployments/devnet-workflow.json)

## Prize categories and exact sponsor_usage answers

### Top 3 Overall

Agent Spending Control combines a restricted Solana token vault, durable request reconciliation, exact owner approvals and an interactive operator interface to give an existing agent bounded spending authority. Actual local TEST transfers and delivered references are demonstrated, with separate recorded finalized Devnet receipts; model output is explicitly simulated.

### DeFi Track Top Prize

We use an Anchor program and SPL-token vault on Solana to enforce task allowances, per-payment caps, approved recipients, expiry, exact owner exceptions and revocation for agent-initiated payments. PostgreSQL reservations and persisted signed attempts support recovery without blind duplicate payments; this is self-operated TEST-token payment infrastructure, not a mainnet lending or trading product.

### AI Track Top Prize

The project provides spending guardrails for an existing research agent: paid tool requests carry task-scoped authority, premium purchases pause for exact owner approval, and payment/delivery evidence survives retries. The demonstrated model/report is simulated; an OpenAI Responses adapter is implemented and mock-tested but live inference and billable API calls are disabled, so no live-model capability is claimed.

### Best Beginner Hack

We are hackathon beginners who built a working Solana agent-spending prototype this weekend, learning Anchor program restrictions, SPL-token vaults, exact approval binding and transaction recovery. We verified actual local TEST payments and delivery, recorded Devnet evidence, and a developer integration with explicit simulation disclosures.

Gaming was skipped because this is not a gaming project. Beginner eligibility was
explicitly confirmed by the user. All four sponsor_usage answers were accepted;
no manual field fallback is needed.

## Submission notes

The user authorized neutral/average survey responses and confirmed Yes for both
resource availability and future-event interest. Exact private survey answers and
MLH confirmation IDs are retained under ignored `.local/mlh-submission-final.json`.

The event accepted the initial project without a video field, but the first
Overall entry was rejected because demo_video_url was required. MLH also rejected
a direct MP4 in that field. After the user supplied the YouTube link, the existing
project was updated and all four entries were successfully submitted. No duplicate
project was created. The direct MP4 remains an extra link.

MLH requires sign-in for its entry page. Anonymous requests redirect to sign-in;
the linked entry ID is from MLH's successful Overall confirmation. Keep the repo
and video accessible for judging. Devnet/private state is unchanged; no new payment
or billable model call was made during submission.
