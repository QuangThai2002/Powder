# CI/CD & Release Automation Audit — Tooling 21.0.5

- Scope: repository tooling only.
- Runtime baseline: Powder 21.0.4 Capacity Guard.
- Gameplay changes: 0.
- CI permission: contents read-only.
- Release write permission: isolated to tag-triggered workflow.
- PR CI: Ubuntu + Windows policy checks, then full regression.
- Cross-platform line endings: text files are locked to LF via `.gitattributes` so SHA/gameplay-freeze evidence is stable on Windows.
- Release: tag/version binding, full regression, ZIP, SHA-256, GitHub Release.
- Dependency maintenance: Dependabot for GitHub Actions.
- Large ZIP policy: source history continues to ignore `*.zip`.
- Production truth: CI PASS does not replace real SLO/load/DR/canary evidence.
