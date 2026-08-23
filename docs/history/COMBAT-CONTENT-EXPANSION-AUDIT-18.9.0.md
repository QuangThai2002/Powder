# Powder 18.9.0 — Combat Content Expansion Audit

## Scope
18.9.0 expands PvE combat without rewriting the 18.8.x combat engine. New content is attached as a deterministic layer over existing BattleCore state.

## Content added
- 5 Elite Affixes: Bulwark, Ravager, Hexer, Regenerator, Breaker.
- 4 Dungeon Modifiers: Mana Drought, Volatile Ground, Fractured Guard, Tempo Rift.
- 5 selective weather/terrain profiles, restricted to suitable Elite/Boss stages only.
- 4 Boss Modifiers layered on top of existing Boss phase/signature design.
- 3 Challenge Combat presets with distinct rules.
- 3 PvE Gauntlets using the existing 3 active + 2 reserve system for five-enemy chains.

## Anti-reskin rule
Challenge modes alter win conditions or resource rules. Gauntlet changes encounter structure through five sequential enemy slots. No separate mode was added solely to rename an existing fight.

## Economy / authority safety
Challenge and Gauntlet stages carry `practiceNoReward=true`.
- no `grantBattleRewards` call;
- no Adventure stage win/mastery write;
- no fallback 180 Coin / 35 EXP;
- Event Server Combat remains server-authoritative and the client content layer does not mutate sessions with `serverCombatSessionId`.

## Coverage
- Adventure stages augmented: 230.
- Elite stages with affix: 34.
- Boss stages with modifier: 12.
- Weather/terrain stages: 28 (Elite/Boss only).
- Pow IDs used by Challenge/Gauntlet templates: all valid in the 99-Pow canonical roster.

## Regression
Critical 18.8.2 gameplay files unchanged byte-for-byte:
- combat-core-v7.js
- combat-mechanics-v17.js
- combat-master-v9.js
- boss-combat-v1861.js
- boss-encounter-designer-v1860.js
- domain-system-v15.js
- ancient-exclusive-runtime-v18.js
- server-combat-v1862.js
- pvp-online-v1881.js
- combat-identity-v1881.js

Player Scene changes are limited to attaching 18.9.0 content metadata, displaying modifier notices, and isolating practice rewards/progression.
