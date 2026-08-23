# Powder 21.0.6 — Supply Chain & Repository Security

## Benchmarked projects
- `mrdoob/three.js`: dedicated CodeQL workflow, least-privilege permissions, scheduled security analysis.
- `nodejs/node`: separates CodeQL/security/CI workflows and keeps release/CI responsibilities explicit.
- `vercel/next.js`: large multi-workflow repository with separated build/test/release automation and code-freeze controls.

## Applied to Powder
- Cross-platform repository security gate with no paid GitHub feature required.
- Block tracked `.env`, private keys, common cloud/GitHub credential patterns.
- Reject broad workflow permissions and unexpected `contents: write`.
- Reject unapproved third-party action sources.
- Keep Dependabot, LF normalization, ZIP exclusion, and runtime 21.0.4 freeze mandatory.
- Scheduled weekly security evidence plus PR/main checks.

No gameplay, player runtime, Supabase schema, or economy logic is changed.
