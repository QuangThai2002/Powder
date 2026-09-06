# Combat VFX Asset Replacement Plan

Scope: Combat presentation only. No damage, turn, targeting, AI, or skill-engine changes.

## A. CURRENT VFX INVENTORY

| Runtime asset or owner | Category | Format / frames / size | Live caller and reference | Reuse | Decision |
| --- | --- | --- | --- | --- | --- |
| `Combat2201HighFantasyAnimeVfx.createProjectile` | Projectile | Phaser Graphics, no file | `CombatNightProjectileBridge.ts` -> `PowView.playAttackLunge` -> `playCombat2201ActionVfx` | All ranged roles; element is mostly color/language data | REPLACE |
| `Combat2201HighFantasyAnimeVfx.createMeleeGlyph` | Slash / melee contact | Phaser Graphics, no file | Same live action route | Knight and Assassin share one arc family; Tank/Fighter use primitive shapes | REPLACE |
| `Combat2201HighFantasyAnimeVfx.playImpact` | Impact | Phaser Graphics, no file | Called after every projectile/slash contact | All elements and most roles share the same burst structure | REPLACE |
| `assets/combat/vfx/fairy-anime/fairy-sigil-v1.png` | Magic circle texture | Single transparent PNG, 1254x1254, one frame | Preloaded by `Combat2200FairyAnimePresentationPatch.ts`; added optionally inside `playCombat2201MagicCircle` | One tinted sigil for every element and tier | REPLACE, keep until circle packs ship |
| `Combat2201HighFantasyAnimeVfx` arc bands, rune nodes, and element language | Magic circle / cast | Phaser Graphics, no file; finite tween sequence | `CombatPresentationDirector.playSkillIntro`, `Combat2101UltimateCinematicPatch`, support pulse | One renderer with color and a small language branch | REPLACE |
| `src/game/combat2/vfx/statusAtlasData/part00..part12` | Burn, poison, stun, freeze | Embedded AVIF sheet, 320x1040; 52 x 80x80 frames | `CombatNightCuratedStatusAssetBridge.ts` -> `PersistentPowStatusVfx` -> `PowView.updateRuntime` | Burn 0-11, poison 12-23, stun 24-35, freeze 36-51 | KEEP until external status packs replace it |
| `Combat2101UltimateCinematicPatch` overlay, flare, aftershock | Ultimate / screen effect | Phaser Graphics and camera flash/shake, no file | `CombatPresentationDirector.playUltimateIntro` / `playUltimateImpact` final owner | Generic element-colored presentation for all Ultimates | REPLACE by tiered asset mapping |
| `ability.iconKey` from `assets/skills/v81/*` | Ultimate banner UI | Single UI image, varies by skill | Ultimate banner only | UI display, not combat VFX | KEEP; do not map it as VFX |

Current persistent status sheet playback: burn 12 frames at 12 FPS loop; poison 12 at 10 FPS loop; stun 12 at 14 FPS loop; freeze 16 at 10 FPS one-shot then held by status state. It is one sprite per Pow and cleans up on scene shutdown.

Compatibility-only, not a live texture preload in the current `main.ts` route:

| File group | State | Decision |
| --- | --- | --- |
| `assets/combat/vfx/preview/*-impact.webp` and `status-*.webp` | Legacy registry references; 48x48 single-frame preview proxies. The current final owner does not preload them. | DELETE LATER |
| `assets/combat/vfx/preview/vfx-elements-a.webp` | Retired atlas/exact-asset patch path; intended 224x224 frames. | DELETE LATER |
| `assets/combat/vfx/real/action-test6-12x6.webp` (192x96) and `status-test5-12x5.webp` (144x60) | Old sprite-test patch only; not installed by live `main.ts`. | DELETE LATER |

## B. PROBLEMS FOUND

1. Projectile, slash, impact, cast, and Ultimate action art are procedural rather than asset-backed, so there is no stable art identity to tune per element or skill family.
2. The single Fairy sigil is tinted for every element. It is not an element-specific magic-circle asset.
3. Normal, skill, and Ultimate mostly scale the same primitive families instead of using distinct visual asset families.
4. The common impact is color-matched to its projectile, so there is no current color mismatch, but it is still the same generic contact burst for physical, magic, heavy, and critical hits.
5. Multi-hit rendering is capped at two visible contacts in the current action renderer; a skill with more than two logical hits cannot show a matching number of impacts.
6. The current Ultimate has intro and impact separation, but no dedicated asset-backed charge, release, travel/slash, and finish layers.
7. The status sheet is embedded as a data URI, which makes replacement, art review, and versioning harder than external named sheets.
8. `ability.iconKey` is used only in the Ultimate banner UI. It must not become a projectile, slash, or impact asset.
9. Magic circles are finite and cleaned up today; the replacement must preserve that lifecycle and never introduce an infinite rotation or particle loop.

## C. NEW ASSET LIST

All new action assets: transparent background, Phaser sprite sheet, one-shot unless noted, preload before `BattleScene.create`, no GIF/video. Phase A can load individual sheets; Phase B should pack same-size assets into category atlases to reduce texture switches. Use normal blend for physical silhouettes and additive blend for energy overlays.

| Asset IDs (same spec within row) | Category / purpose | Sprite-sheet format | Playback / anchor / scale / blend | Intended skills or elements |
| --- | --- | --- | --- | --- |
| `physical_light`, `physical_heavy`, `arrow`, `bullet_energy` | Projectile | 8 frames, 4x2, 192x96 per frame, WebP with alpha, 14 FPS | One-shot; center anchor, rotate to travel; 0.75-1.30; normal plus optional additive trail | Basic physical, Marksman, gun/rail variants |
| `fire_small`, `fire_heavy`, `water`, `ice`, `lightning`, `wind`, `leaf`, `earth`, `steel`, `poison`, `light`, `dark`, `lava`, `storm`, `special_ancient` | Element projectile | 8 frames, 4x2, 192x128 per frame, WebP with alpha, 14 FPS | One-shot; center anchor, rotate to travel; 0.80-1.45; additive | Elemental ranged skills and Ultimate travel |
| `slash_light`, `slash_heavy`, `slash_cross`, `slash_multi`, `slash_pierce`, `slash_fire`, `slash_ice`, `slash_lightning`, `slash_wind`, `slash_leaf`, `slash_steel`, `slash_dark`, `slash_light`, `slash_ancient` | Slash | 6 frames, 3x2, 256x192 per frame, WebP with alpha, 16 FPS | One-shot; target-center anchor; 0.80-1.55; additive | Knight, Assassin, melee elemental skills |
| `impact_physical`, `impact_heavy`, `impact_magic`, `impact_fire`, `impact_water`, `impact_ice`, `impact_lightning`, `impact_wind`, `impact_leaf`, `impact_earth`, `impact_steel`, `impact_poison`, `impact_light`, `impact_dark`, `impact_critical`, `impact_ultimate` | Contact impact | 8 frames, 4x2, 192x192 per frame, WebP with alpha, 18 FPS | One-shot; target-center anchor; 0.75-1.65; additive | Every hit; one visual impact per displayed hit |
| `circle_neutral`, `circle_fire`, `circle_water`, `circle_ice`, `circle_lightning`, `circle_wind`, `circle_leaf`, `circle_earth`, `circle_steel`, `circle_poison`, `circle_light`, `circle_dark`, `circle_lava`, `circle_storm`, `circle_ancient` | Magic circle | 8 frames, 4x2, 384x384 per frame, lossless PNG with alpha, 12 FPS | One-shot; caster-body anchor; 0.50-1.40; additive | Cast and support circles; each must have its own rune language, not recolor only |
| `cast_core_neutral`, `cast_core_elemental` | Charge / release accent | 6 frames, 3x2, 192x192 per frame, WebP with alpha, 15 FPS | One-shot; caster-body anchor; 0.65-1.25; additive | Basic release, skill charge, self-support release |
| `status_burn`, `status_poison`, `status_freeze`, `status_stun`, `status_heal`, `status_shield` | Skill-linked status | 12 frames, 4x3, 128x128 per frame, WebP with alpha; freeze may use 16 frames 4x4 | Burn/poison loop at 10-12 FPS; freeze/stun one-shot then held; body/ground/head anchors by status; normal or additive | Persistent status and support outcomes |
| `ultimate_intro_standard`, `ultimate_charge_standard`, `ultimate_release_standard`, `ultimate_impact_standard`, `ultimate_finish_standard` | Ultimate Tier 1 | 6-8 frames per sheet, 384x384, PNG/WebP alpha, 12-16 FPS | One-shot; role/target anchor by phase; 0.9-1.5; additive | Standard Ultimate; fast and readable |
| `ultimate_intro_high`, `ultimate_charge_high`, `ultimate_release_high`, `ultimate_impact_high`, `ultimate_finish_high` | Ultimate Tier 2 | 8-10 frames per sheet, 512x512, PNG/WebP alpha, 12-16 FPS | One-shot; 1.0-1.8; additive; camera reaction remains code-owned | High-rarity Ultimate |
| `ultimate_intro_ancient`, `ultimate_charge_ancient`, `ultimate_release_ancient`, `ultimate_impact_ancient`, `ultimate_finish_ancient` | Ultimate Tier 3 | 10-12 frames per sheet, 640x640, PNG/WebP alpha, 12-16 FPS | One-shot; 1.1-2.0; additive; hard duration cap in code | Ancient / exclusive Ultimate |

Magic-circle phase contract: frames 0-1 APPEAR, 2-3 BUILD, 4 CHARGE, 5-6 RELEASE, 7 FADE. The sprite is destroyed after fade or scene shutdown; it does not loop or cover the HUD.

Ultimate tier contract:

| Tier | Presentation rule | Duration target |
| --- | --- | --- |
| Tier 1 - Standard | Intro, short charge, release route, impact, finish; no heavy cinematic hold | 0.9-1.2 s presentation budget |
| Tier 2 - High rarity | Separate charge and stronger impact/aftershock; controlled camera reaction | 1.2-1.6 s presentation budget |
| Tier 3 - Ancient / exclusive | Distinct element/role pack, stronger layering, still readable and interrupt-safe | 1.5-2.0 s presentation budget |

No dedicated screen-effect bitmap is required. Keep screen flash, overlay, and camera reaction code-owned so they remain resolution-independent and HUD-safe.

### Mapping Plan

| Runtime route | Cast / circle | Travel or contact | Impact | Ultimate addition |
| --- | --- | --- | --- | --- |
| Marksman | `circle_<element>` for skills | `arrow` or `bullet_energy`; element projectile for elemental skills | `impact_physical` or `impact_<element>` | Tier pack plus `special_ancient` when mapped |
| Mage / Enchanter | `circle_<element>` | Matching elemental projectile asset | `impact_magic` or `impact_<element>` | Tier pack plus release/finish layer |
| Healer / Musician | `circle_light`, `circle_water`, or own element circle | `light`, `water`, or `bullet_energy` | `impact_magic`; status sheet when effect persists | Self-target release and finish layer |
| Tank / Fighter | `cast_core_neutral` or element circle for skills | No travel; `physical_heavy` contact accent | `impact_heavy` | Tier pack + target or self finish |
| Knight | `cast_core_neutral` or element circle | `slash_light`, `slash_heavy`, or `slash_<element>` | `impact_heavy` / `impact_ultimate` | Tier pack + `slash_ancient` where required |
| Assassin | `cast_core_elemental` for skills | `slash_multi` or `slash_dark` | `impact_critical` once per visual hit | Tier pack + finish layer |

The mapping module should select assets from role, element, action tier, and existing ability traits. It must not alter resolver output, hit count, damage, status application, target selection, or turn flow.

## D. FIRST TEST PACK

The first 12 deliverables test the pipeline before full production:

1. `physical_light`
2. `arrow`
3. `fire_small`
4. `slash_light`
5. `slash_heavy`
6. `slash_multi`
7. `impact_physical`
8. `impact_magic`
9. `impact_critical`
10. `circle_neutral`
11. `circle_fire`
12. `ultimate_test_fire_high` package: `intro`, `charge`, `release`, `impact`, and `finish` sheets following the Tier 2 format

First test mappings: Marksman normal uses `arrow -> impact_physical`; Mage fire skill uses `circle_fire -> fire_small -> impact_magic`; Knight uses `slash_heavy -> impact_physical`; Assassin uses `slash_multi -> two impact_critical` instances; one fire High-rarity Ultimate exercises all five Ultimate phases.

## E. FILES CODEX NEEDS TO CHANGE AFTER ASSETS ARRIVE

| File | Future change |
| --- | --- |
| `src/game/combat2/vfx/CombatVfxAssetMap.ts` (new) | Asset IDs, sheet metadata, role/element/tier mapping, preload manifest |
| `src/game/combat2/vfx/Combat2201HighFantasyAnimeVfx.ts` | Replace Graphics projectile/slash/impact/circle drawing with mapped sprite playback; retain finite cleanup and procedural fallback until coverage is complete |
| `src/game/combat2/views/Combat2200FairyAnimePresentationPatch.ts` | Preload mapped circle assets and retire the single Fairy sigil only after coverage reaches 100% |
| `src/game/combat2/views/Combat2101UltimateCinematicPatch.ts` | Select Tier 1/2/3 intro, charge, release, impact, and finish assets; preserve current banner, camera, and cleanup ownership |
| `src/game/combat2/vfx/CombatNightCuratedStatusAssetBridge.ts` | Point status playback to external named sheets after the six status assets are supplied |
| `src/game/combat2/vfx/CombatNightSupportAssetBridge.ts` | Map heal/shield pulse and persistent support assets after their replacement sheets exist |
| `src/game/combat2/vfx/CombatNightRegressionGate.ts` | Add asset manifest, preload, cleanup, and per-hit visual-count checks |

Do not modify combat resolvers, `BattleScene` damage logic, target logic, `SkillActionResolver`, or `BasicAttackResolver` for this replacement.

## F. OLD ASSETS THAT CAN BE REMOVED LATER

| Candidate | Removal condition |
| --- | --- |
| `assets/combat/vfx/preview/vfx-elements-a.webp` | Remove only after retired atlas/exact VFX modules and compatibility references are removed or isolated from all test routes |
| `assets/combat/vfx/preview/*-impact.webp` and `status-*.webp` | Remove after `CombatNightSupportAssetBridge` no longer depends on `Combat2140ExactVfxRegistry` and replacement status assets pass regression |
| `assets/combat/vfx/real/action-test6-12x6.webp` and `status-test5-12x5.webp` | Remove after the obsolete `Combat2144RealSpriteTestPatch` test path is retired |
| `assets/combat/vfx/fairy-anime/fairy-sigil-v1.png` | Remove only after every live magic-circle route resolves a replacement sheet and preload regression passes |
| `src/game/combat2/vfx/statusAtlasData/part00..part12` | Remove only after external burn/poison/freeze/stun sheets replace the embedded atlas and lifecycle tests pass |

Do not remove `assets/skills/v81/*`; those are UI skill icons, not obsolete combat VFX.

## G. BLOCKERS

1. No replacement source assets have been supplied yet, so no live texture mapping should be implemented now.
2. Tier 2 and Tier 3 need a product rule for rarity-to-presentation mapping (for example, rarity, Ancient tag, or exclusive tag); this is presentation metadata only.
3. Every supplied sheet needs transparent alpha, the declared frame grid, and a stable final filename before preload and mapping work can begin.
4. This plan intentionally stops here: no assets or runtime code were created or changed.
