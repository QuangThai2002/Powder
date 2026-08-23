# Powder 19.9.0 — Release Freeze Guide

## 1. Run the frozen build

Serve the folder normally and open:

`index.html?freeze=1`

Do not edit Combat/Skill/Domain/Boss files during this test.

## 2. Run Freeze Audit

In the Release Freeze panel verify:

- Runtime PASS.
- 99 Pow / 396 skill.
- 230 PvE stages.
- 4 Boss profiles.
- 3 Challenge / 3 Gauntlet.
- 3 + 9 Domain catalog.
- Save PASS.
- Manifest hash is shown.

Export the Freeze JSON.

## 3. Admin import

Open Admin → Launch and import the exported Freeze JSON into **Gameplay Freeze & Final Regression**.

The Admin gate also checks the local catalog plus existing Integrity and Safe Rollout server states. A file from another build/version is rejected.

## 4. Release Seal

The 19.9 Release Seal requires the existing Pilot, Load/Integrity, Recovery, Polish QA and field checklist plus a PASS 19.9 Freeze Audit.

A seal from 19.8 or a seal with a different manifest hash is invalid.

## 5. Freeze policy

From this point until 20.0.0:

- Do not add Pow, skills, modes or balance changes.
- Do not redesign Combat FX unless it fixes a blocker.
- Do not change reward/economy policy as polish.
- A Critical/High fix must be documented, re-run the freeze tool, regenerate boot manifest/checksum and create a new seal.

Node verification command:

`node tools/powder-release-freeze-gate-v1990.mjs .`
