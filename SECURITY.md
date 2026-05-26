# Security Policy

## Scope

This repository hosts 13 demonstration agents — twelve on Base Sepolia (testnet), one against a local Theseus dev node. Nothing in this repo holds production funds. The deployed contracts on Base Sepolia (see `contracts/deployments/base-sepolia.md`) are demo-only and any value sent to them is sent to a demo wallet.

Reports that matter most:

- **A live contract on Base Sepolia behaves differently from what the source code in `contracts/src/` describes** (storage-layout mismatch, missing access check, agent-only modifier bypass).
- **A demo route in `ui/src/app/<demo>/` can be made to write to chain on behalf of the agent EOA without the agent having signed off** (i.e. a way to forge the on-chain commit step).
- **A secret-shaped value lives in the current tree** (real API key, private key, blob token, etc.). The history was rewritten on 2026-05-25 to remove a publicly-derivable Foundry/Anvil test key from `.env.example`. If you find anything else, please flag it.
- **An issue in a demo's LLM prompt or scoring rule causes the agent to produce a verdict that disagrees with the on-chain commitment** (the contract says PRICED, the dossier blob says REFUSED).

Out of scope:

- Vulnerabilities in dependencies that don't reach a live code path on `demo-agents.theseus.network` (e.g. dev-only or non-runtime packages flagged by npm audit). These are tracked via Dependabot — `.github/dependabot.yml`.
- The Aave V3 vendored snapshot in `contracts/lib/aave-v3-core/` — that's upstream Aave, reported to them.
- Anything specific to the original Aave Oracle PoC's runtime integration (the local-node tooling in `agents/`, `cli/`, `pallets/`, `tools/`). That stack is illustrative and not deployed publicly.

## Reporting

Email **eric@theseus.network** with "security" in the subject line. Encrypt with our PGP key on request.

We'll acknowledge within 72 hours and aim to confirm-or-decline within 7 days. If the issue affects funds or user data on a *production* Theseus deployment (not this demo repo), follow Theseus Network's primary disclosure process at https://theseus.network — this file covers only the demo repo.

Please do not file a public GitHub issue for security-sensitive findings.

## What you'll get back

- Acknowledgement and a CVE-style write-up of the fix, with attribution if you want it.
- A demo-bounty: the smallest meaningful Base Sepolia ETH transfer + a public credit in the repo. We don't run a funded bounty program — these are demos — but we'll do our best to make it worthwhile if you found something real.
