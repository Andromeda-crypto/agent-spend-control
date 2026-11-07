# Browser findings — 2026-11-06

Inspected the complete **persistent local-validator demo** in real installed
Google Chrome 156 through Playwright, using an isolated temporary browser profile.
Desktop viewport: 1440 × 1000; narrow console: 375 × 812. Public replay also
checked at 320 px. These are real Chromium rendering/interaction checks with
emulated viewport sizes, not native iOS/Safari or physical-device testing.
The in-app Browser connection tool was unavailable, so local Chrome was used.
No Devnet deployment, upgrade, buffer creation or billable OpenAI call occurred.
Existing finalized Devnet evidence is reused by the replay.

## Observed and fixed

| Finding in the actual browser | Change / verification |
|---|---|
| Automatic polling moved keyboard focus to BODY | Unchanged data no longer redraws; changed views restore stable control focus and open details. Focus survives a poll. |
| Run action hidden under developer details | Visible “Selected task · next step” card with Run research, approval guidance, completion and chain revocation status. |
| Small, low-contrast supporting text | Darker supporting copy, larger boundary/receipt text, explicit focus rings, 44px mobile navigation targets. Desktop and narrow screenshots reviewed. |
| A failed sign-in returned a raw code | Readable owner-key error, opening state and disabled submit. Real invalid-key → valid-key flow passed. |
| Disconnection produced repeated transient notices | Persistent connection status retains last confirmed data and retries; offline/reconnect and refresh during approval passed. An offline approval shows a readable error and becomes retryable instead of remaining disabled. |
| Payment confirmation could be confused with delivery | Independent “Payment confirmed” and “Delivery complete/failed”; model steps say simulated/no payment. Fee/rent and receipt JSON are collapsed details. |
| Credential values were rendered in creation/rotation dialogs | Private download action replaces displayed credential text. No token is inserted into the DOM or public replay. Sign-in remains masked. |
| Two Vite applications shared an optimizer cache, producing an actual blank screen/504 | Separate application caches and forced console optimization on launcher startup. Full Chrome flow then passed. |
| Mode/allowance explanations required product knowledge | Pre-sign-in session label, demo guide, allowance definitions, clear simulation/self-operated labels, separate guided public replay. |

## Verified walkthrough

`npm run test:browser` against the existing local stack completed masked sign-in,
invalid credential recovery, funded task selection, focus retention, modal Tab /
Shift+Tab trapping and Escape restoration, starting research, the 20 TEST allowed
purchase, the pending 40 TEST premium purchase, exact owner approval, two actual
local transfers and service deliveries, simulated final report, gateway revoke
and observed on-chain revocation. Refresh retained task selection and confirmed
revocation. No horizontal overflow at 375 px. No browser JavaScript errors.
Screenshots were reviewed for desktop, mobile and the public replay; they remain
private under ignored `.local/qa`. No password-filled screenshot, trace, HAR,
video, environment dump or credential download was recorded.

`npm run test:replay` serves the **production artifact** under a restrictive CSP.
It verifies scene navigation and focus, hash refresh, evidence loading/error
states, 1440/375/320 px widths, real evidence matching the checkpoint, no console
auth code or known operator credential in the output, and GET-only static
requests without Authorization or any API route. This check needs no database,
wallet or running operator stack. The local workflow check deliberately consumes
and revokes one existing local task; seed another explicitly before repeating.

The blocked-request restriction is verified in actual local-program tests. Its
public scene and the public revocation scene are labeled **illustrated**; neither
is falsely presented as another Devnet transaction. The two payment scenes link
to the already verified, finalized Devnet transfers.

## Remaining verification

Native Safari/iOS/Android, screen-reader review, target-host HTTPS/TLS and ingress,
Docker image/Compose runtime, database restore and the hosted private tunnel are
not verified. This is not a comprehensive accessibility or custody-security audit.
See [HOSTING.md](HOSTING.md) for concrete deployment gates and boundaries.

## Existing-agent integration — 2026-11-07

The new private Integration workspace was exercised in Chrome at 1440/375px.
A separate CLI process, holding only its scoped agent credential, purchased basic
reference data, waited for owner premium approval in the browser, received both
actual local-token service deliveries and repeated the same job without another
payment. Task selector, readable readiness/limits, copy-example action, request
outcomes and credential-free screenshots were checked. Navigation icons were
marked decorative so controls have stable accessible names. The refined design
was reviewed on desktop and narrow views; mobile navigation fits all five tabs.

The public site gained a developer entry point and guide link. Its deployed
production artifact passed the existing anonymous hosted checks and byte audit;
no privileged runtime was published. The real outside-developer pilot is still
pending selection of an actual agent/repository.

## Selected internal research pilot

The actual research workflow at `examples/reference-agent/workflow.ts` now submits
its premium reference through `packages/sdk/src/reference-tool.ts`'s shared
`submitReference` boundary. Its transaction-bound internal port performs no HTTP
or approval waiting while locked. Fresh full-stack tests verify the existing
`research:<run>:2` key, exact 40 TEST payload, one approval and the premium
receipt's continued inclusion in the report input. A fresh Chrome research run
also passed real local payments/delivery, owner approval, simulated report,
reconnect/refresh and confirmed revocation. Its test task is revoked as expected;
all prior ledger/access/wallet state is retained. This establishes the selected
internal pilot, not an outside customer adoption result.
