# Powder 20.1.0 · Live Ops & Incident Readiness

## Scope
20.1.0 is an operational hardening release built on the frozen 20.0 launch candidate. It does not add combat content or rebalance gameplay.

## Added
- Admin Live Ops Incident Console.
- Incident severities: Critical / High / Medium / Cosmetic.
- Incident states: Open / Monitoring / Resolved / Won't Fix.
- Server health snapshots combining Integrity, rollout state, pilot presence and stale Server Combat checks.
- Owner-only Production Emergency Stop and explicit Emergency Resume from the Live Ops console.
- Official Launch preflight now includes a `liveOpsIncidents` invariant: any open/monitoring Critical or High incident blocks `ready=true`.
- Read-only player diagnostics mode: `index.html?diagnostics=1`.
- Diagnostics export contains build/device/network/runtime diagnostics only; no token, password or save payload is transmitted.

## Safety
- Gameplay freeze baseline remains 22/22 byte-identical.
- No production candidate registration or activation is performed by this build task.
- Production remains on the existing active release until the real launch gates are satisfied.
