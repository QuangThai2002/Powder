# powder-admin-official-launch — 20.7.0

Production Launch Control API. Production mutations are Owner-only and fail closed.

Workflow: register candidate → record four build evidence → save plan → submit → Owner approve → ARM → canary 5% → server-derived health capture → 20% → 50% → 100% → server-derived health capture → finalize.

Stage health cannot be supplied by the client. It is derived by `powder_capture_rollout_stage_health_v2070` from Observability samples for the active build and rollout ring.
