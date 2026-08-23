# Live Ops & Incident Guide · 20.1.0

## Admin workflow
1. Open Admin → Launch.
2. Review **Live Ops · 20.1.0** health and incident blocker count.
3. Use **Capture Snapshot** before/after an operational change.
4. Open an incident for reproducible launch/runtime problems.
5. Classify severity:
   - Critical: data loss, economy/reward exploit, widespread login/save failure, security issue, service unavailable.
   - High: major gameplay/service feature unusable for a significant cohort.
   - Medium: degraded feature with workaround.
   - Cosmetic: presentation-only issue.
6. Critical/High must be resolved before Official Launch preflight can report ready.
7. Emergency Stop is Owner-only and immediately enables production maintenance through the existing release channel.

## Player diagnostics
Open `index.html?diagnostics=1` on the affected device and choose **Export JSON**. The JSON is local/read-only and contains no save payload or credentials.

## Important
20.1.0 does not make a failed Pilot/Load/Recovery gate pass. Incident health is an additional gate, not a replacement for earlier release evidence.
