# Powder 21.0.16 — Implementation Notes

## Runtime
`js/combat-impact-feedback-v21016.js`

- Depends on `POWDER_COMBAT_PRESENTATION_V21015` lifecycle rather than creating another DOM observer.
- Listens to `powder:combat-presentation-sync` and `powder:resource-pressure`.
- Reads existing `pulse-*` classes and existing status/CC markup.
- Writes presentation-only datasets:
  - `data-ci216-impact`: none/light/medium/heavy/fatal
  - `data-ci216-feedback`: impact/break/heal/shield/control/dot/status/evade/fatal/cast/exclusive-cast/ultimate-cast
  - `data-ci216-control`: none/freeze/stun/locked
  - `data-ci216-skip`: 0/1
- Dispatches read-only `powder:combat-impact-feedback` events for diagnostics.
- Does not calculate HP, damage, mana, status duration, rewards or turn order.

## Styling
`css/combat-impact-feedback-v21016.css`

- Severity-weighted impact ring feedback.
- Shield/guard, shield break, heal and high-tier cast each have distinct one-shot timing.
- Freeze/stun/skip-turn lock remains readable after the transient pulse.
- `hot/critical` pressure removes secondary panel/bar paint and shortens the transient ring while keeping the core cue.
- Reduced-motion has a static visible fallback.

## Freeze boundary
Do not modify any file listed in `RELEASE-FREEZE-BASELINE-19.9.0.json`.
In particular, `js/player-combat-scene-v1862.js` already emits the pulse/status signals 21.0.16 needs and remains byte-identical.

## QA contract
The 21.0.16 Chrome gate must prove:
- runtime/style/dependencies available;
- basic → skill2 → ultimate/crit → fatal severity ordering;
- shield-break and heal use distinct feedback paths;
- freeze and stun classification plus visible skip-turn lock;
- hot pressure reduces secondary paint without hiding core feedback;
- state restored and no serious browser runtime exception.

The existing 21.0.15 collision/vitals gate remains unchanged and must continue to pass.
