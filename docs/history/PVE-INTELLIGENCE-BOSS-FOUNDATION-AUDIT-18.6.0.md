# Powder 18.6.0 — PvE Intelligence & Boss Combat Foundation Audit

## Scope
18.6.0 extends the validated 18.5.2 Combat stack without changing the fixed four-skill kit model, star progression rules, PowBall animation, online economy authority, or PvP server authority.

Primary goals:
- Tactical PvE AI for Normal / Elite / Boss tiers.
- Better skill and target choice without future-player-action knowledge.
- Canonical Boss phase policy shared by BattleCore, AI and HUD.
- Boss phase intent / telegraph foundation.
- Story Boss signature foundation.
- Admin-only AI/Boss diagnostics.

## Tactical AI 18.6.0
New runtime: `js/combat-ai-v1860.js`.

Behavior added:
- Avoid empty cleanse, overheal and redundant shielding.
- Prioritize emergency heal/protection when allies are in crisis.
- Hold Ultimate when there is no meaningful finish/crisis window.
- Prefer lethal / near-lethal targets when appropriate.
- Consider element matchup and role priority.
- Avoid redundant hard CC.
- Different decision discipline for `standard`, `elite`, `boss` tiers.
- AI never receives future player choices.

### Decision sweep
- 99 Pow × 2 AI tiers × 3 scenarios = **594 decisions**.
- Illegal skill/target decisions: **0**.
- Empty action selection: **0**.
- Normal and Elite both remain fully legal; Elite uses the stronger tactical line more consistently.

### Behavioral assertions
- Full-health team: healer avoids unnecessary heal.
- Crisis ally: healer prioritizes heal/protection.
- Low effective-HP target receives higher finishing priority.
- Favorable elemental matchup scores above resisted matchup when otherwise comparable.

## Canonical Boss policy
`js/boss-encounter-designer-v1860.js` is the single encounter policy used by core + HUD.

| Boss | Phases | Thresholds | AI pattern sequence |
|---|---:|---|---|
| Daily | 2 | 50% | probe → blood_pressure |
| Weekly | 3 | 70%, 35% | formation_probe → line_break → cataclysm |
| Promotion | 2 | 50% | evaluation → breakthrough |
| Story | 2 | 55% | guardian → enrage |

Policy validator: **4/4 valid**.

Boss decisions emit server-neutral local PvE intent metadata used only for presentation/debug:
- intent label
- hint
- pattern id
- confidence

Player HUD displays only readable tactical intent/telegraph. Internal policy/debug remains in Admin Combat Lab.

## Story Boss signature
New Story signature: **Trấn Áp**.

Validated result:
- Targets fastest living player Pow.
- Applies `Slow` for 2 turns.
- Removes 14 turn-meter points.
- Test: Zephyrion meter 78 → 64, Slow=2 turns.

## Combat regression
Full canonical action sweep after 18.6.0 AI/Boss changes:
- Pow: **99**
- Action slots: **396/396 executed**
- Exceptions: **0**
- Unavailable unexpectedly: **0**
- Empty targets: **0**
- Invalid BattleCore states: **0**
- No-effect/dead actions: **0**

Action classes:
- offense 171
- hybrid 97
- support 109
- enemy-utility 16
- dual-mode 3

## Lifecycle / long combat
Special lifecycle cases: **8/8 PASS**.

80-battle 5v5 stress:
- Finished: **80/80**
- Wins: 35
- Losses: 45
- Exceptions: 0
- Invalid states: 0
- Soft-locks: 0
- Capped battles: 0
- Average actions: 24.9
- Longest: 76 actions
- Max replay size: 725 events

## Browser/runtime gate
Production script order: **87 modules**.

Player runtime:
- Powder app version: 18.6.0
- Page errors: 0
- Console errors: 0
- Horizontal overflow: false
- Save validation errors: 0

Story Boss scene smoke:
- Scene API: `18.6.0-pve-intelligence-boss-foundation`
- AI runtime: `18.6.0-pve-intelligence`
- Boss policy validator: 4/4
- Story Boss HUD: phase `1/2`
- Mobile overflow: false
- Page/console errors: 0

Admin:
- 15/15 pages navigate correctly.
- Combat Lab AI/Boss diagnostics render without overflow.
- Weekly diagnostic reports 3 phases at 70% / 35% with expected pattern sequence.

Long-session warm stress:
- 270 nav clicks
- 100 modal cycles
- 12 PowBall cycles
- DOM delta: -1 node
- active intervals after settle: 0
- active rAF after settle: 0
- heap: ~30 MB
- page/console errors: 0

## Static / preload integrity
- JavaScript syntax: **104/104 PASS**
- `tsc --allowJs --checkJs`: legacy/custom-window typing diagnostics remain, but direct missing/scope/callability categories are all 0:
  - TS2304 0
  - TS2552 0
  - TS2451 0
  - TS2448 0
  - TS2449 0
  - TS2349 0
- CSS files: 17, delimiter issues 0
- HTML duplicate IDs: 0
- Local HTML src/href missing: 0
- CSS url() missing: 0
- Direct client `/rpc/`: 0
- Direct client `/rest/v1/player_saves`: 0
- Service Worker `ignoreSearch:true`: 0
- Active references to old 18.5.2 boot/rank/scene/Boss files: 0

Final preload:
- entries: **1,229**
- unique: **1,229**
- production scripts: **87**
- missing: 0
- size mismatch: 0
- hash mismatch: 0
- total bytes: **183,062,098**
- manifest hash: **7bfed682b4a4e216**

## Authority boundaries preserved
- PvE AI is local gameplay logic only; it does not alter PvP server authority.
- Event Combat client-declared wins remain unable to grant Online rewards.
- Daily/Weekly Online Boss rewards remain locked until a server verifier exists.
- Economy, Cloud Save, Rank and inventory authority are unchanged.
- No framework or package-manager migration.

## Deployment note
True HTTPS deployment smoke, staging restore drill and 20–50 real-player pilot are not fabricated in this sandbox. 18.6.0 must remain a candidate until Official Release Gate evidence is satisfied.
