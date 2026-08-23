# Powder 19.8.0 — Polish QA Guide

## 1. Open the exact build in QA mode

Open:

`index.html?polish=1`

For Real Pilot telemetry at the same time, use an enrolled Pilot account and:

`index.html?pilot=1&polish=1`

## 2. Test target widths

Run at least these viewport widths:

- 320 px
- 360 px
- 390 px
- 430 px

For each width, test portrait first; landscape is recommended where practical.

## 3. Required views

Check at minimum:

- Home/top navigation
- Adventure
- PvE Combat
- Boss Combat
- PvP Online lobby
- PvP active battle
- Bành Trướng activation/question flow
- Vô Lượng question modal
- Challenge/Gauntlet entry/result
- Equipment/Inventory modal-heavy screens

## 4. Combat visual checks

Verify:

- Pow artwork does not overlap critical HP/Mana information.
- Damage/heal/shield numbers remain inside the visible arena.
- Stun/freeze/skip-turn callouts do not clip at screen edges.
- Domain cinematic copy remains readable.
- Skill strip can be horizontally scrolled without moving the whole page.
- Skill buttons remain comfortable to tap.
- Keyboard/modal opening does not hide the active question controls.

## 5. Network UX

During a PvP test:

- disconnect the network;
- confirm the existing network banner is visible;
- reconnect;
- confirm authoritative state refreshes;
- verify there is no duplicate reconnect banner from Launch Polish.

## 6. Run Polish Audit

In the `?polish=1` overlay:

1. Run UI Audit on the important views.
2. Run the 10-second FPS probe where available.
3. Export the Polish Audit JSON.
4. Open Admin → Launch Polish QA.
5. Import the JSON.

The QA gate must show PASS before Release Seal 19.8 can become eligible.

## 7. Do not mark PASS from screenshots alone

A screenshot can demonstrate layout, but the final gate should use the exported audit plus Real Pilot/Load/Recovery evidence. Do not create a Release Seal if Critical/High Pilot blockers remain open.
