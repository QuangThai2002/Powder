# Rollback Plan — 19.1.0

19.1.0 does not require a database migration or new Edge deployment, so rollback risk is intentionally small.

1. Keep the known-good `Powder-19.0.0-Combat-Release-Candidate.zip` and checksum.
2. If 19.1.0 causes a client regression, redeploy the 19.0.0 static build.
3. Do not roll back Supabase PvP v5 / Domain / Identity data solely because of a 19.1 client UI issue; 19.1 did not change those contracts.
4. 19.0.0 uses its own `powder-assets-v1900` cache while 19.1.0 uses `powder-assets-v1910`, avoiding mixed build-sensitive assets.
5. Verify release endpoint/minimum-version policy before forcing clients back to 19.0.0.
6. Verify Cloud Save state and one PvP reconnect after rollback.
7. Record cause, affected build, rollback time and validation result before reopening rollout.
