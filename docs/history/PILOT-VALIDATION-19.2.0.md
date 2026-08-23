# Pilot Validation — 19.2.0

Use the Admin field checklist as the source of truth for completion timestamps.

Recommended evidence per item:
- PvP: match IDs / replay IDs from two separate accounts/devices.
- Reconnect/AFK: timestamp + expected server turn/strike behavior.
- 9 Domains: one successful activation/effect log for each Domain.
- Mobile: screenshots or short captures at 320, 360, 390, 430 CSS px.
- Soak: exported readiness diagnostics before/after session.
- Pilot: participant count + severe/major/minor issue list.
- Load: concurrency level, p95 latency/error rate and observed failures.
- Rollback: deployment timestamp, restored build version and Cloud Save recovery result.

Do not mark a field item complete based only on static/unit tests.
