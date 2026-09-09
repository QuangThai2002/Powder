# Powder Combat2 Canonical Sync Audit

Generated from current player runtime data and the Combat2 adapter. This report proves runtime alignment only, not independent design authority.

- Canonical Pow: **99**
- Fully resolved: **74**
- Pow with errors: **25**
- Sync: **74.75%**
- Gate: **FAIL**

## Verified

- `POWDER_DATA` and `POWDER_SKILL_V81` contain the same 99 unique Pow IDs.
- Combat2 resolves every Pow ID and preserves canonical base stats, rarity, element, and role.
- Main snapshots final PvE/Boss combatant stats through `POWDER_ENGINE.createCombatant` before CombatState initialization.
- All 396 canonical skill IDs, descriptions, and skill images resolve.
- All 99 passive images resolve.

## Blocking Findings

| PowId | Pow | Area | Classification | Issue | Required action |
|---|---|---|---|---|---|
| cindercore | Cindercore | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_cindercore has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| pyrewing | Pyrewing | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_pyrewing has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| arcbison | Arcbison | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_arcbison has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| mirefang | Mirefang | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_mirefang has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| scorchmane | Scorchmane | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_scorchmane has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| aegiscarab | Aegiscarab | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_aegiscarab has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| rimehorn | Rimehorn | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_rimehorn has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| lumibloom | Lumibloom | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_lumibloom has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| cloudtalon | Cloudtalon | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_cloudtalon has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| galehart | Galehart | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_galehart has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| tempestfin | Tempestfin | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_tempestfin has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| ignivar | Ignivar | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_ignivar has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| volcarnos | Volcarnos | Passive | ENGINE_SUPPORT_REQUIRED | Passive lava_core_legendary has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| calderion | Calderion | Passive | ENGINE_SUPPORT_REQUIRED | Passive lava_emperor_core has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| ferronyx | Ferronyx | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_ferronyx has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| stormeon | Stormeon | Passive | ENGINE_SUPPORT_REQUIRED | Passive v8_pending_stormeon has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| noxabyss | Noxabyss | Passive | ENGINE_SUPPORT_REQUIRED | Passive ancient_nox_soul_throne has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| frostmaw | Frostmaw | Passive | ENGINE_SUPPORT_REQUIRED | Passive ancient_frost_dual_form has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| magmorax | Magmorax | Passive | ENGINE_SUPPORT_REQUIRED | Passive ancient_magma_genesis has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| venomarch | Venomarch | Passive | ENGINE_SUPPORT_REQUIRED | Passive ancient_venom_absorb has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| luxarion | Luxarion | Passive | ENGINE_SUPPORT_REQUIRED | Passive ancient_lux_balance has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| tempestrix | Tempestrix | Passive | ENGINE_SUPPORT_REQUIRED | Passive ancient_tempest_fate has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| starter_fire_flarion | Flaris | Passive | ENGINE_SUPPORT_REQUIRED | Passive flarion_passive has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| starter_fire_flarion | Flaris | Starter special mechanics | ENGINE_SUPPORT_REQUIRED | Structured specialMechanic fields exist but SkillActionResolver does not execute them. | Implement the named starter resource, field, follow-up and star handlers without changing their supplied coefficients. |
| starter_water_aquelion | Aqueli | Passive | ENGINE_SUPPORT_REQUIRED | Passive water_seal_cold_tide has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| starter_water_aquelion | Aqueli | Starter special mechanics | ENGINE_SUPPORT_REQUIRED | Structured specialMechanic fields exist but SkillActionResolver does not execute them. | Implement the named starter resource, field, follow-up and star handlers without changing their supplied coefficients. |
| starter_leaf_sylvion | Sylvi | Passive | ENGINE_SUPPORT_REQUIRED | Passive life_vein_blossom_prosperity has no structured mechanic definition. | Supply an explicit canonical trigger/effect schema; do not substitute V8.1 Core metadata. |
| starter_leaf_sylvion | Sylvi | Starter special mechanics | ENGINE_SUPPORT_REQUIRED | Structured specialMechanic fields exist but SkillActionResolver does not execute them. | Implement the named starter resource, field, follow-up and star handlers without changing their supplied coefficients. |

## Counts

```json
{
  "canonicalPowCount": 99,
  "uniquePowCount": 99,
  "canonicalSkillCount": 396,
  "skillArtCount": 396,
  "adapterResolved": 99,
  "designCanonicalVerified": false,
  "fullyResolved": 74,
  "powWithErrors": 25,
  "syncPercent": 74.75,
  "statMismatch": 0,
  "basicAttackMismatch": 0,
  "skill1Mismatch": 0,
  "skill2Mismatch": 0,
  "ultimateMismatch": 0,
  "passiveMismatch": 0,
  "starMismatch": 0,
  "passiveImageMismatch": 0,
  "skillImageMismatch": 0,
  "descriptionMismatch": 0,
  "sourceIncomplete": 0,
  "engineSupportRequired": 25,
  "designConflict": 0
}
```
