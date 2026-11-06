# Solana preparation

No Solana program or payments exist yet. No funds were spent.

Tool inventory: Node v26.12.1 / npm 11.20.0 available. Docker, psql,
Rust, Solana and Anchor were not found on PATH during baseline inspection.
Install Rust, the Solana CLI and Anchor using official installation guidance;
pin mutually compatible versions after a local build passes. Do not generate
or commit wallet keypairs in this repository. Use a separate local test wallet.

Build task policy and vault PDAs keyed by owner and task ID; purchase receipt
PDAs keyed by task and unique purchase ID. Validate signer, version, mint,
recipient, expiry, revocation, per-payment maximum and remaining allowance.
Update counters and transfer via signed token CPI in one transaction. Exceptions
must carry owner authorization bound to purchase details and policy version;
never exceed total budget. Test concurrent purchases, replay, wrong accounts,
revocation and withdrawal locally before Devnet deployment. Record upgrade
authority and account rent/network fee costs separately.

## x402 investigation (2026-11-06)

Official references:
- https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_svm.md
- https://solana.com/docs/tools/x402-facilitator
- https://solana.com/docs/tokens/basics/transfer-tokens

The exact SVM scheme specifies transaction structure and verification rules.
A program-signed transfer from our PDA vault must not be assumed compatible
with that structure. Compatibility is UNVERIFIED. Next: choose a facilitator,
inspect supported version/scheme/network, test a vault-instruction transaction
through verification, settlement and paid response delivery. Record actual
results before any support claim. First implement a self-operated direct
vault-backed reference service if the facilitator rejects custom instructions.
Never substitute an unrestricted agent wallet to obtain compatibility.
