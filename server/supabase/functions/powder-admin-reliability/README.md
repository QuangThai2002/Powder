# powder-admin-reliability · 20.8.0

Admin-only control plane for Production Reliability. Health is derived server-side from Observability 20.2, Recovery 20.4, Integrity 19.6 and LiveOps incidents 20.1. The endpoint never accepts client-supplied error rate, P95, crash or save-conflict metrics.

Actions: `state`, `watchdog`, `set_config`, `set_mode`.

Production automation is **not armed by the migration**. Owner must explicitly ARM it after Observability and Recovery are real. A scheduler may call `powder_reliability_watchdog_v2080` periodically using service-role credentials.
