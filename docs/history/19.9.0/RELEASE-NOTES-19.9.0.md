# Powder 19.9.0 — Release Notes

## Release Freeze

19.9.0 is the final freeze gate before the planned 20.0.0 Official Live milestone.

### Added

- Player `?freeze=1` Final Freeze Audit.
- 22-file SHA-256 gameplay baseline.
- Admin Release Freeze console and JSON import.
- Release Seal 19.9 tied to the imported real Player manifest hash.
- Automated Node freeze gate for canonical catalogs, rewards, save/recovery and Server Combat contracts.

### Corrected

- The Admin Release Seal no longer depends on a Player Boot Loader global that is not normally present on `admin.html`.
- Pilot client reports app version 19.9.0 while continuing to use the stable Real Pilot 19.7 backend contract.
- Current player boot/pilot/official v1980 runtime files are removed from active build paths.

### Gameplay

No gameplay or balance changes. The 22 critical Combat/PvP/Boss/Domain files are byte-identical to 19.8.0.

### Release state

`official=false` and `releaseState=release-freeze-gate` remain intentional until field evidence is complete.
