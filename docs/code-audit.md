# Code Audit — Nexus Games

## Bugs

### Critical
- **Cannonball double damage** — `rts/game.js:391` applies damage, then line 394 applies it again for cannonballs. Cannons deal 2x intended damage.
- **TD tower targeting bug** — `td/logic.js:165-166` has redundant/broken target selection. First condition compares `e.wpIdx > bd` where `bd` is a distance, not a waypoint index.

### Medium
- **Duplicate `rtsOrderAttack()`** — Defined in both `rts/ui.js:207` and `rts/game.js:270`. One should be deleted.
- **Click radius mismatch** — Base click radius is 70 in `rtsHandleClick` but 60 in `rtsHandleRightClick`. Inconsistent feel.
- **Chain lightning uses setTimeout** — `rts/game.js:442` uses `setTimeout` instead of tick-based timing. Visual desyncs under lag.
- **Particle radius mutated in draw** — `rts/rendering.js:189` modifies `p.radius` inside the render function. State mutation should happen in tick.
- **CSS orphan** — `css/rts.css:265-266` has rules with no selector (syntax error). `color:#ff8888 !important;` floating loose.
- **Hex color parsed every frame** — `rts/cinematic.js:28-32` calls `parseInt(hex.slice(...))` every animation frame. Should pre-parse once.

### Low
- **Dead `logs` array** — `td/logic.js:42` declares `logs` but `addLog()` manipulates DOM directly. Never used.
- **Dead `rc2()` function** — `rts/game.js:511` defines `rc2()` but it's never called in that file.
- **Path cell loop runs once** — `td/logic.js:69` has `for(let r=0;r<1;r++)` which only runs once. Either the loop is pointless or should be `r<2`.
- **`rtsBuild()` stub** — `rts/ui.js:205` wraps `trainUnit()` with no added value.

## Architecture Issues

### Global State Sprawl
20+ globals scattered across files. Key state:
- `rts/camera.js`: `rtsRAF`, `rtsFrame`, `rtsGold`, `rtsEntities`, `rtsParticles`, `camX`, `camY`, etc.
- `rts/game.js`: `aiGold`, `aiTimer`, `rtsProjectiles`, `rtsLastTime`
- `rts/ui.js`: `rtsBuildPopupOpen`, `buildStructureMode`, `rtsBuildingSource`
- `td/logic.js`: `canvas`, `ctx`, `W`, `H`, `state`, `raf`, `lastTime`

**Recommendation**: Group into state objects per game (`tdState`, `rtsState`).

### Faction Config Duplication
40+ faction-specific conditionals scattered through game logic. Ternary chains like:
```js
const color = isTank?'#ff6600' : isWizard?'#88ffff' : isNecro?'#440088' : ...
```
**Recommendation**: Extend `FACTION_CFG` with projectile colors, unit stats, UI icons, sounds. Replace conditionals with config lookups.

### Magic Numbers
Hundreds of hardcoded values. Priority extractions:

| Area | Examples | Suggested Constant |
|------|----------|--------------------|
| TD enemy scaling | `40 + wave*20` HP, `0.6 + wave*0.05` speed | `ENEMY_BASE_HP`, `ENEMY_HP_SCALING` |
| TD game settings | `200` gold, `20` lives, `45` spawn interval | `GAME_CONFIG` object |
| RTS AI timing | `240` decision interval, `400` attack interval | `AI_DECISION_INTERVAL`, `AI_ATTACK_INTERVAL` |
| RTS click radii | `70, 60, 50, 36, 20, 14` | Entity property or `CLICK_RADII` map |
| RTS projectile speeds | `9, 11, 6, 4` | Add to `FACTION_CFG` |
| RTS AOE radii | `80` tank, `55` missile, `200` chain lightning | Named constants |

### Large Functions
| Function | File | Lines | Issue |
|----------|------|-------|-------|
| `openBuildPopup()` | rts/ui.js:6 | 170 | Handles 4 build contexts; split per context |
| `workerTick()` | rts/game.js:129 | 88 | 5 states; should be state machine |
| `warriorTick()` | rts/game.js:278 | 67 | Move + target + attack in one function |
| `drawRTSProjectiles()` | rts/warriors.js:296 | 130 | 6 projectile types; split per type |
| `drawWarriorShadow()` | rts/warriors.js:130 | 90 | 60 lines for cape alone |

## Rendering Duplication

### Health Bars (4+ copies)
Same green→orange→red logic repeated in:
- `rts/rendering.js:174` (base)
- `rts/structures.js:348` (structures)
- `rts/structures.js:381` (cannons)
- `rts/warriors.js:40` (warriors)
- `rts/workers.js:52` (workers — always green, inconsistent)

**Fix**: Extract `drawHealthBar(rc, x, y, w, h, fraction)`.

### Selection Rings (3 copies)
- `rts/workers.js:42`
- `rts/warriors.js:30`
- `rts/structures.js:372`

**Fix**: Extract `drawSelectionRing(rc, x, y, rw, rh)`.

### Shadow/Glow (87 occurrences)
`shadowColor` + `shadowBlur` pattern repeated everywhere with inconsistent values (6-30 blur).

### TD Tower Drawing
4 tower types repeat octagon base drawing (3x each in `td/towers.js:7-27`). Extract `drawOctagon()` helper.

### TD Particle Spawning
`td/logic.js:218-249` has 4 nearly identical branches. Extract particle factory function.

## HTML / CSS

### Inline Event Handlers
20 `onclick`/`onmouseenter`/`onmouseleave` handlers in HTML. Should move to JS with `addEventListener`.

### Inline Styles
28 `style=` attributes in HTML. Faction stat bar colors/widths hardcoded. Should use CSS classes + data attributes.

### No Responsive Design
- 0 media queries
- Fixed canvas sizes (700x500 TD, 1200x580 RTS)
- Fixed sidebar (220px), fixed padding (40px)
- No touch event handlers
- `overflow-x: hidden` on body masks overflow

### Accessibility
- No ARIA labels on buttons
- Canvas elements have no alt text
- No keyboard navigation support

### CSS Issues
- `css/rts.css:265-266` — orphaned rules with no selector
- Excessive `!important` on `.rts-attack-btn:hover` (lines 269-271)
- `.stat-val.green` defined but unused
- Hardcoded colors in RTS hover states instead of CSS variables

## AI System (rts/game.js)
- Very basic: fixed 4-second decision intervals, hardcoded build order
- No adaptation to player strategy
- Sends all warriors at once every 400 frames
- Doesn't defend when attacked
- Never builds more than one barracks
- Never trains necromancers (deadSwordsmenPool may be dead code for AI)

## Priority Fix Order

### Immediate (bugs) — DONE
1. ~~Fix cannonball double damage~~
2. ~~Fix TD tower targeting logic~~
3. ~~Remove duplicate `rtsOrderAttack()`~~
4. ~~Fix CSS orphaned rules~~

### Short-term (cleanup) — DONE
5. ~~Extract health bar / selection ring helpers~~
6. ~~Extract magic numbers into constants (TD_CONFIG, AI_CONFIG, COMBAT)~~
7. ~~Replace ternary chains with config lookups (PROJECTILE_TYPES, HIT_PARTICLES, UNIT_LABELS)~~
8. ~~Move particle state mutation out of draw functions~~
9. ~~Pre-parse hex colors in cinematic~~
10. ~~Fix click radius mismatch (centralized CLICK_RADII)~~
11. ~~Remove dead code (logs, rc2, rtsBuild, pointless loop)~~
12. ~~Consolidate TD particle spawning (data-driven)~~

### Medium-term (architecture) — MOSTLY DONE
13. ~~Refactor `openBuildPopup()` — config-driven, shared addOpt(), no per-faction branching~~
14. ~~Move all 20 inline event handlers from HTML to JS (event delegation)~~
15. ~~Overhaul AI — faster decisions, multi-barracks, base defense, smarter attacks~~
16. ~~Fix AI buildings never completing (assign workers to construct)~~
17. ~~Fix ATTACK button (sends all warriors, not just selected)~~
18. Group globals into state objects
19. Refactor worker/warrior tick into state machines
20. Add basic responsive CSS / canvas scaling

### Long-term (polish)
21. Add accessibility (ARIA, keyboard nav)
22. Add touch support for mobile
23. Standardize game lifecycle for adding new games
