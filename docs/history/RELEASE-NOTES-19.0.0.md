# Powder 19.0.0 — Combat Release Candidate

19.0.0 is a release-candidate hardening build. It does not add a new combat mode.

## Added
- Combat RC runtime gate for 99 Pow, 396 fixed skill IDs, 99 unique identities, 9 Domain Expansions, 3 Simple Domains, Combat Content, Server Combat client and PvP client.
- Duplicate battle-start guard (900 ms) to stop accidental double-start/double-click race conditions.
- Secondary offline reward guard: one local battle-reward mutation per generated RC battle ID. Server-authoritative rewards remain unchanged.
- Rate-limited pre-battle local save backup for reward-bearing offline fights.
- Long-session diagnostics and lifecycle sweep while outside active combat. No heavy sweep is executed during an active battle.
- Admin > Combat Test Lab > RC Readiness & Regression Gate.
- Exportable RC diagnostics JSON from Admin.

## Production server audit snapshot
- PvP catalog: 99
- Combat identity: 99 / 99 unique signatures
- Assassin role: 10
- Domain Expansion: exactly 9 = 6 normal + 3 special
- Simple Domain: 3
- Server-verified Domains: 9 / 9
- powder-pvp Edge: v5 ACTIVE, JWT enabled
- PvP action/domain RPCs audited as service-role authority.
- Reward/claim tables use primary-key/idempotency keys for daily, event, learning claims; PvP actions use `(match_id,user_id,client_action_id)`.

## Release status
Automated/static gates may pass, but this build is **Release Candidate**, not automatically Production Ready. Production Ready requires real-device field validation and a 20–50 player pilot.
