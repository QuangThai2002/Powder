# Powder 21.0.9 — Release Provenance & Recovery

## Benchmarked projects / standards
- `slsa-framework/slsa-github-generator`: provenance should describe exactly which source/build process produced an artifact. Its current README recommends GitHub artifact attestations instead of the older generator for new GitHub implementations.
- `sigstore/cosign`: verify artifacts by digest, prefer identity/keyless signing where supported, and never trust a mutable tag in place of a content digest.
- `actions/attest-build-provenance`: binds an artifact name+digest to signed SLSA provenance. Its documentation also states that private/internal repositories need eligible GitHub Enterprise Cloud support for artifact attestations.

## Applied to Powder
- Release ZIP remains SHA-256 addressed.
- Generate `PROVENANCE.json` containing runtime version/buildId, exact Git commit/tree/ref, artifact size+SHA-256, Final Gate digest and `release.json` digest.
- Generate `RECOVERY.json` with the current source identity, parent source candidate, previous runtime buildId and an explicit human-approval policy.
- Generate `PROVENANCE-VERIFY.json` and fail release if any artifact/evidence/source digest does not match.
- Release workflow now re-runs repository policy, supply-chain policy, Final Gate, Browser E2E and Visual/Performance Gate before packaging.
- A PR dry-run workflow packages and verifies the provenance chain without publishing a GitHub Release.
- Never automatically set `official=true` and never automatically roll production back.

## Why GitHub Attestation is optional
Powder is currently a private repository. The GitHub attestation action documents plan restrictions for private/internal repositories, so 21.0.9 does not make that capability mandatory. The local provenance format is plan-agnostic and can later be supplemented with `actions/attest` when the repository/account supports it.

No combat, learning, economy, PvP, save schema or live server behavior is changed.
