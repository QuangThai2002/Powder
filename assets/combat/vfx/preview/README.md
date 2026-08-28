# Combat2 2.13.0 VFX Preview

Combat2 loads the temporary asset-first preview library from this folder.

Expected files:

- fire-impact.webp
- steel-impact.webp
- water-impact.webp
- leaf-impact.webp
- earth-impact.webp
- wind-impact.webp
- lightning-impact.webp
- lava-impact.webp
- storm-impact.webp
- ice-impact.webp
- poison-impact.webp
- light-impact.webp
- dark-impact.webp
- status-burn.webp
- status-freeze.webp
- status-stun.webp
- status-heal.webp
- status-shield.webp

The preview set is curated from both user-provided `img` and `img2` libraries. Missing files are safe: Combat2 skips the visual asset instead of falling back to geometric elemental/status shapes.

Status preview images currently use representative frames from the supplied sprite sheets. They can later be replaced by full sprite-sheet animation without changing combat mechanics.
