# Powder 19.9.0 — Release Freeze Audit

Date: 2026-08-22
Build: `powder-19.9.0-release-freeze`
Release state: `release-freeze-gate`
Official: `false`

## Purpose

19.9.0 freezes gameplay before 20.0.0. No new Pow, skill, Combat mode, balance coefficient, Boss mechanic, Domain mechanic, PvP rule, or reward policy is introduced by this release.

Policy: only a verified Critical/High blocker may justify a change to a frozen gameplay file. Any change to the 22-file gameplay baseline invalidates the freeze gate until the build is re-audited.

## Frozen gameplay baseline

`RELEASE-FREEZE-BASELINE-19.9.0.json` stores SHA-256 + byte size for 22 critical files copied from the validated 19.8.0 build.

Automated result: **22/22 byte-identical; changed = 0**.

Covered layers include Combat Core, mechanics, AI, Boss, Domain, Server Combat, PvP Online, Combat Identity, Combat Content, Player Combat Scene and RC guards.

## Canonical content regression

- Pow: 99/99.
- Fixed kits: 99/99.
- Fixed skills: 396/396.
- Unique fixed skill IDs: 396/396.
- Combat Identity: 99 profiles / 99 unique signatures.
- Sát thủ: 10.
- Adventure: 12 islands / 230 stages.
- Story Boss stages: 12.
- Boss encounter profiles: Daily / Weekly / Promotion / Story = 4.
- Elite Affix: 5.
- Dungeon Modifier: 4.
- Boss Modifier: 4.
- Weather/Terrain: 5.
- Challenge: 3.
- Gauntlet: 3.
- Giản Dị: 3.
- Bành Trướng: 9 = 6 normal + 3 special.

## Reward / save / recovery contracts

The freeze gate verifies that:

- Online Battle reward remains fail-closed on the client.
- Online Boss reward requires Server Combat authority.
- Challenge/Gauntlet remain practice/no-reward content.
- Save migration/recovery hooks remain present (`migrateStarSave`, full backup and restore flow).
- Cloud Save keeps revision/conflict semantics.
- Server Combat exposes both Event and Boss session starts.

## Production server snapshot

Read-only audit at freeze time:

- PvP Pow: 99.
- PvP Identity: 99.
- Unique identity signatures: 99.
- Bành Trướng: 9 = 6 normal + 3 special.
- Giản Dị: 3.
- Stale Server Combat: 0.
- Integrity snapshot: `ready=true`.
- Orphan Match Player: 0.
- Orphan Match Pow: 0.
- Bad Player Save: 0.
- Production rollout: 100%.
- Emergency mode: `normal`.
- Real Pilot active users at audit time: 0.

No migration, Edge redeploy, rollout change, or production build activation is performed by 19.9.0.

## Freeze Audit flow

Open `index.html?freeze=1` on the exact 19.9 build. The player-side Freeze panel performs the runtime invariant check and exports a JSON containing the final manifest hash. Import that JSON into Admin → Release Freeze.

Admin cross-checks the imported Player Audit against canonical catalog data and the existing server Integrity/Safe Rollout state. The 19.9 Release Seal then uses the imported manifest hash; Admin no longer assumes that the Player Boot Loader exists inside the Admin page.

## Automated regression

- JavaScript syntax: 131/131 PASS.
- Service Worker syntax: PASS.
- CSS structural: 35/35 PASS.
- `index.html`: duplicate IDs 0; missing local refs 0.
- `admin.html`: duplicate IDs 0; missing local refs 0.
- Boot manifest: 1,254/1,254 valid.
- Boot script order: 103/103 present.
- Boot manifest hash: `2cf3b2d9807f0484`.
- Release Freeze Node gate: PASS.
- Release Freeze runtime isolated gate: PASS.
- Official player seal: no seal=false; wrong manifest=false; correct manifest=true.
- Gameplay baseline: 22/22 unchanged.

## Not claimed as PASS

Real-device/browser E2E, 20–50 player Pilot, external load/concurrency, rollback/Cloud recovery, and final 20.0 rollout are field gates. They are not fabricated by 19.9.0.
