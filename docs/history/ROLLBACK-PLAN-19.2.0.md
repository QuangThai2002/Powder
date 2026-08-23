# Rollback Plan — 19.2.0

## Trigger rollback when
- repeatable reward duplication appears;
- PvP authoritative state diverges after reconnect;
- Cloud Save corrupts or rolls back player inventory/progression;
- critical mobile UI prevents combat actions;
- crash/stutter regression is severe in normal sessions;
- Domain question/server authority can be bypassed.

## Client rollback
1. Stop new public rollout / pause registration if necessary.
2. Redeploy the last validated 19.1.0 Production Readiness client.
3. Keep the existing production Supabase schema and Edge Functions unless the incident is server-side; 19.2.0 itself adds no backend migration.
4. Force service-worker/cache refresh by reverting the deployed build metadata/cache version.
5. Verify Cloud Save and one PvE + one PvP match before resuming traffic.

## Server rollback
19.2.0 contains no database/Edge deployment, so there is no 19.2-specific server rollback. If an older server issue is discovered, use the corresponding prior server migration/Edge rollback procedure rather than modifying player save data manually.
