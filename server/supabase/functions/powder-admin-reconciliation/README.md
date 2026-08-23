# Powder 20.12.0 — Reconciliation Admin

Owner/Admin read-only state and safe reconciliation controls.

- `state`: posture, open cases, recent scans/drills, repair audit.
- `scan`: evidence-only reconciliation. Never replays resources.
- `drill`: Owner-only sandbox drill.
- `propose_repair`: proposes a control-plane repair from evidence.
- `approve_repair`: Owner-only approval.
- `apply_repair`: Owner-only application; re-validates proof and never edits player resources.

`resource_adjustment` is intentionally denied in 20.12.0.
