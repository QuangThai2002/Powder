# Powder 19.8.0 — Release Notes

## Launch Polish

19.8.0 focuses on the last player-facing polish pass before Release Freeze.

### Mobile and viewport

- Dynamic visual viewport support.
- Safe-area handling.
- Better mobile keyboard behavior.
- Final 320–430 px Combat/PvP layout hardening.
- Improved touch targets and skill-strip scrolling.

### Combat presentation

- Edge-safe FX/callout rendering.
- Domain cinematic copy constrained to the visible viewport.
- Better phone-scale Combat typography and unit presentation.
- No Combat mechanics, coefficients, turn rules, skill definitions, PvP balance, or Boss/Domain gameplay were changed.

### PvP/reconnect UX

- Launch Polish integrates with the existing reconnect/network banner instead of rendering a duplicate notification layer.
- PvP and Domain question dialogs receive final phone-safe scrolling and touch spacing.

### Pilot correctness

- New `pilot-live-v1980.js` reports app version 19.8.0 to the existing Real Pilot 19.7 backend contract.
- Normal non-Pilot users continue to avoid Pilot background sampling.
- Release Seal 19.8 requires both Real Pilot server evidence and a 19.8 Polish QA audit.

### Release state

`official=false` remains intentional. 19.8 is a Launch Polish gate, not the Official Live activation.
