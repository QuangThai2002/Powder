# Observability Audit — Powder 20.2.0

- Production observability default: OFF
- Staging auto-HOLD test: PASS (enabled with 0 samples => insufficient + unhealthy => Official preflight observability=false)
- Staging restored OFF after test: PASS
- Release manifest exposes version/enabled/sampleRate/sampleSalt: PASS
- Server aggregate alias regression: fixed and retested
- Direct anon/authenticated table/RPC access: denied
- `powder-observability`: ACTIVE, JWT ON
- `powder-admin-observability`: ACTIVE, JWT ON
- Combat flush suppression: PASS
- Telemetry endpoint self-observation exclusion: PASS
- Pilot appVersion/buildId drift fix: PASS
- 22-file gameplay freeze: PASS
- Production release state was not activated or changed by this build.
