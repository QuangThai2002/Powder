# Real Pilot Audit — 19.7.0

## Server
- Migration: `real_pilot_release_1970` + indexes.
- Edge `powder-pilot`: v2 ACTIVE, JWT required.
- Edge `powder-admin-pilot`: v3 ACTIVE, JWT required.
- Pilot tables RLS enabled; anon/authenticated direct SELECT revoked.
- Current initial server state: 0 active pilot, 0 device, 0 open Critical/High issue.

## Privacy/performance
- Telemetry opt-in via Pilot Mode and cohort membership.
- Report interval is bounded; important events may trigger an earlier flush.
- No frame-by-frame telemetry.
- No raw save payload/token/password stored.
- Player normal mode: legacy pilot sampler is dormant.

## Release gate
- Pilot field requires source `pilot-server-19.7.0`.
- 19.6 seal cannot be reused.
- 19.7 seal requires live Pilot Admin state with `pilotEvidencePass=true`.
- Manifest mismatch invalidates seal.

## Final regression
- JavaScript syntax: 128/128 PASS; Service Worker PASS.
- CSS structural gate: 31/31 PASS.
- Boot manifest: 1250/1250 entries, 0 hash/size errors; manifest hash `5eef6bd51d9eee01`.
- HTML: 0 duplicate IDs, 0 missing local references.
- Canonical data: 99 Pow, 396/396 unique fixed skill IDs, 99 unique Combat Identity signatures, 10 Sát thủ.
- Critical gameplay byte compare vs 19.6.0: 0/22 changed.
- Pilot normal mode: 0 Pilot interval / 0 Pilot event listener.
- Pilot during active Combat: telemetry request blocked and queued for safe flush.
- Release Seal: manual Pilot evidence does not satisfy 19.7; only `pilot-server-19.7.0` with server `pilotEvidencePass=true` can satisfy the Pilot field.
