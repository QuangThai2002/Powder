# Admin Manual Combat Lab Audit — 18.8.2

## Catalog / identity
- Pow available: 99/99
- V8.1 skill records: 99/99
- Fixed skill slots: 396/396
- Unique skill IDs: 396/396
- Canonical roles: 9
- Sát thủ: 10
- Active/reserve formation: 3 + 2 per side

## Manual interactions verified
Browser interaction harness verified:
- 99 options in each Pow selector;
- 9 Bành Trướng options;
- 3 Giản Dị options;
- 10 Sát thủ after canonical role runtime;
- 3 active cards each side;
- 4 skill buttons for selected Pow;
- Freeze overlay appears after manual Freeze;
- skill action changes target HP in sandbox;
- floating FX nodes and event log are produced;
- Giản Dị fire layer activates;
- activating Vô Lượng removes Giản Dị and enables Void layer;
- reserve swap changes the active lineup;
- Rút Kiếm visual sword node is generated;
- Tọa Sát Bát Đồ visual ring is generated;
- browser page errors: 0.

## Isolation audit
`admin-combat-lab-v1882.js` contains no direct:
- `fetch()`;
- Online `.request()` calls;
- `/functions/v1/` calls.

The tool is therefore an Admin in-memory visual sandbox, not a hidden production combat endpoint.

## Visual coverage
Manual preview covers source→target direction, damage, crit, heal, shield, Stun, Freeze, Burn, Poison, Cleanse, KO/Revive, reserve swap, Simple Domain and Expansion Domain layers.

## Known boundary
This tool is designed to inspect presentation/state feedback. It intentionally does **not** claim that its simulated numbers reproduce production balance exactly. For authoritative PvP result verification, use the normal server-authoritative PvP flow and its event ledger.
