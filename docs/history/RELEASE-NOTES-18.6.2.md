# Powder 18.6.2 — Server Combat Session & Reward Authority

## Added

- Server-owned Combat session/state/unit/event tables.
- Authenticated Edge endpoint `powder-combat-v1862`.
- Event Combat Online server authority for action, enemy response, HP, winner and Event progress.
- Server event-ledger replay in Player Combat scene.
- Server energy/cooldown UX preview while keeping server as final validator.
- Server-owned reserve promotion mirrored into Player scene.
- Boss server-session/qualification foundation for future full parity.

## Security

Client Server Combat requests contain only actor/skill/target selection and session identity. Client damage, HP, crit, win/loss and reward declarations are not accepted.

Server RPCs are service-role-only and reached through the JWT/device/rate-guarded Edge Function.

Legacy Event client `win=true` remains blocked.

## Boss compatibility decision

Daily/Weekly Boss Player bridge is deliberately not enabled yet. Boss Combat 2.0 reaction-window mechanics and qualification questions are not fully server-authoritative at parity in 18.6.2.

Rather than regress Boss gameplay or trust local qualification:

- Boss Combat 2.0 remains intact for Player presentation/gameplay;
- Online Boss rewards remain locked;
- backend Boss session foundation remains available for the next parity phase;
- Promotion Boss keeps its existing Rank Authority flow.

## Fixed during QA

- Fixed ambiguous PL/pgSQL `statuses` variable before release.
- Removed duplicate/fake local enemy response after a server action.
- Server action ledger now drives Online Combat damage/heal/crit/status presentation.
- Server state owns reserve promotion; local replacement queue cannot diverge.
- Normalized server `Paralysis`/`Magma Burn` presentation to Stun/Burn visual state.

## Unchanged

- 99-Pow fixed skill identity.
- Offline/local PvE Combat Core.
- Boss Combat 2.0 local mechanic set.
- Tactical AI foundation.
- PowBall animation/timing/rates.
- Equipment/artifact/gacha balance.

## Release status

18.6.2 is a release candidate. Production activation remains blocked until real HTTPS/restore/pilot gates pass.
