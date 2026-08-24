# Powder 21.0.16 — Combat Impact & Status Feedback 2.0 Benchmark

## Scope
Presentation-only feedback for receiving damage, shield break, heal, crowd control and high-impact casts. No combat formula or gameplay state changes.

## 1. Pokémon Showdown Client
Reference: https://github.com/smogon/pokemon-showdown-client
Relevant source: `play.pokemonshowdown.com/src/battle-animations.ts` and `battle-animations-moves.ts`.

Observed practice:
- Battle animation/scene code is separated from the battle simulation and text/state layer.
- Move presentation is event-driven and move-specific rather than a permanent decorative loop.

Adopted in Powder:
- 21.0.16 stays outside the frozen combat simulation/scene files.
- It consumes existing Combat V7 pulse/status DOM signals instead of recalculating combat outcomes.

## 2. Phaser 3
References:
- https://docs.phaser.io/phaser/concepts/tweens
- https://docs.phaser.io/phaser/concepts/cameras

Observed practice:
- Tweens are bounded by duration/easing and are appropriate for one-shot visual responses.
- Camera effects such as shake/flash are timed effects; Phaser explicitly warns against starting camera effects every update.

Adopted in Powder:
- Impact, break, heal and control emphasis are short one-shot animations.
- No new continuous shake, particle loop or frame polling is introduced.
- Stronger feedback is reserved for stronger pulse classes (`skill2`, `exclusive`, `ultimate`, crit/fatal).

## 3. PixiJS 8
Reference: https://pixijs.com/8.x/guides/components/ticker

Observed practice:
- Frame callbacks should be explicitly controlled, can be started/stopped, prioritized and FPS-limited.
- Work that does not require a frame loop should not create one unnecessarily.

Adopted in Powder:
- 21.0.16 creates no Ticker-like loop and no new MutationObserver.
- It piggybacks on the existing 21.0.15 combat-presentation sync event and pressure governor.
- Hot/critical pressure shortens/removes secondary paint while preserving core hit/status feedback.

## Decision
Use a semantic presentation adapter:
1. Read existing `.pulse-*`, `.has-status-*`, `.cv7-cc-lock` signals.
2. Convert them to read-only datasets (`data-ci216-*`).
3. Let CSS provide compositor-friendly one-shot feedback.
4. Keep gameplay-freeze files byte-identical.
5. Prove behavior in real Chrome with severity, shield-break, heal, freeze/stun, pressure and runtime-exception checks.
