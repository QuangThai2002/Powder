# Powder 20.13.0 — Release Notes

**Economy & Reward Exploit Hardening** adds a server-first anti-abuse layer ahead of canonical mutations. It rejects client authority fields, rate-limits mutation intents, protects txKey replay semantics, records abuse events, introduces evidence-bound server verification and adds an Official Launch hard gate.

The player-side guard is only an early UX filter; it is not trusted as security. Server policy remains authoritative. Existing Reliability 20.8, Transaction Safety 20.9, Mutation Gateway 20.10/20.11 and Reconciliation 20.12 remain active.

No Pow, skill, damage formula, PvE/PvP combat behavior or gameplay balance was changed.
