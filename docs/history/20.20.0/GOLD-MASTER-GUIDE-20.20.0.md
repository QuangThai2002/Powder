# Powder 20.20.0 — Gold Master Guide

## Purpose
20.20.0 is the immutable release artifact immediately before 21.0 Official Production. It does not add gameplay.

## Freeze domains
`GOLD-MASTER-LOCK-20.20.0.json` records a deterministic SHA-256 aggregate for four domains:
1. **Code** — player/admin JS, CSS, HTML, release metadata and deployment shell files.
2. **Schema** — Supabase SQL migrations.
3. **API** — Supabase Edge Function TypeScript source.
4. **Assets** — all packaged game assets.

Run local verification with:
`node tools/powder-gold-master-lock-v20200.mjs .`

Regenerate only before signing a new candidate:
`node tools/powder-gold-master-lock-v20200.mjs . --write`

## Required production sequence
1. 20.19 predecessor RC reaches 100% and is finalized with stage health PASS.
2. Register the exact 20.20 Gold Master ZIP SHA-256.
3. Record current 20.20 RC/manual-smoke + rollback drill evidence using service/CI.
4. Record Gold Master evidence using `powder_gold_master_record_v20200` from service/CI.
5. Owner+AAL2 approves and ARMs the release plan.
6. Roll 20.20 through 5% → 20% → 50% → 100%, capturing server health at each stage.
7. Only after the 100% stage is healthy may the build be finalized and then promoted to the 21.0 Official line.

## Fail-closed conditions
Production stays HOLD if any of the following is true: predecessor 20.19 was not finalized at 100%, Gold Master evidence is stale/missing, any domain hash changes, Critical/High blockers are non-zero, rollback drill is missing, server health is missing, or any existing hardening gate is not READY.

## Important
Local QA PASS is not production evidence. The artifact intentionally remains `official=false`.
