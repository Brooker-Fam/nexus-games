# Nexus Games — Refactor Plan

## Approach
- Static site, no build step, no bundler, no npm
- Plain `<script>` tags loading separate JS files
- Vercel serves files as-is
- Each file: single responsibility, under ~500 lines
- Extract and split incrementally — never rewrite logic, just move code

## File Structure
```
index.html                     — HTML markup (270 lines)

css/base.css                   — Variables, reset, layout, header, tabs (170)
css/td.css                     — Tower defense styles (192)
css/rts.css                    — Deep Space Ops / RTS styles (274)

js/shared/audio.js             — Sound engine + SFX definitions (85)
js/shared/ui.js                — Particles + tab switching (27)

js/td/logic.js                 — TD: state, config, enemies, towers, game loop (345)
js/td/towers.js                — TD: tower drawing (gun, laser, missile, cryo) (377)
js/td/rendering.js             — TD: background, path, enemies, bullets, particles (280)

js/rts/factions.js             — Faction config (FACTION_CFG + FACTION_DATA + dso state) (60)
js/rts/commands.js             — Command queue system (multiplayer-ready) (103)
js/rts/faction-cards.js        — Faction character art + sidebar previews (573)
js/rts/camera.js               — RTS: state vars, camera, input (130)
js/rts/entities.js             — RTS: entity factories, startRTS (220)
js/rts/draw-helpers.js         — Shared drawing helpers (health bars, selection rings) (25)
js/rts/ui.js                   — RTS: build popup, click handling, HUD (310)
js/rts/game.js                 — RTS: AI, tick, combat, projectiles, game loop (600)
js/rts/rendering.js            — RTS: draw orchestration, minimap, background (198)
js/rts/structures.js           — RTS: base, temple, structures, cannons (609)
js/rts/workers.js              — RTS: worker drawing per faction (235)
js/rts/warriors.js             — RTS: warrior + projectile drawing (412)
js/rts/elites.js               — RTS: elite, wizard, necromancer, tank (410)
js/rts/cinematic.js            — Faction reveal animation (106)

js/init.js                     — Bootstrap, screen navigation, event handlers (100)
```

## Completed
- [x] Extract CSS into separate files
- [x] Extract all JS into separate files
- [x] Split all files under ~625 lines
- [x] Move all inline JS out of index.html
- [x] Organize into game folders (js/td/, js/rts/, js/shared/)
- [x] Centralize faction config into factions.js
- [x] Consolidate dso* state vars
- [x] Split CSS into base + td + rts
- [x] Fix all critical and medium bugs (cannonball double damage, TD targeting, CSS orphans, etc.)
- [x] Extract shared draw helpers (health bars, selection rings)
- [x] Extract all magic numbers into named constants (TD_CONFIG, AI_CONFIG, COMBAT, etc.)
- [x] Replace ternary chains with config lookups (PROJECTILE_TYPES, HIT_PARTICLES, CLICK_RADII)
- [x] Refactor build popup — config-driven, no per-faction branching
- [x] Move all 20 inline event handlers from HTML to JS
- [x] Move 13 inline styles to CSS classes
- [x] Refactor worker/warrior tick into state handler functions
- [x] Add RTS command system (multiplayer Phase 1)
- [x] Add RTS speed controls (1x/2x/3x)
- [x] Fix AI buildings never completing
- [x] Centralize cannon config in FACTION_CFG
- [x] Consolidate TD particle spawning (data-driven)
- [x] Entity IDs use incrementing counter (deterministic)

## Next Steps

### Standardize game lifecycle
- [ ] Each game exports: init(), cleanup()
- [ ] Tab switching calls cleanup() on old game, init() on new
- [ ] Adding a game = add folder + register in init.js

### Responsive design
- [ ] Add media queries for mobile/tablet
- [ ] Scale canvas elements to fit viewport
- [ ] Add touch support for mobile play

### Multiplayer (Phase 2+)
- [ ] Add PartyKit for WebSocket rooms
- [ ] Broadcast commands between players
- [ ] Replace AI with second player's commands

### Further cleanup (optional)
- [ ] Group globals into state objects
- [ ] rts/structures.js could split cannons into own file
- [ ] rts/faction-cards.js could split per-faction character art

## Principles
- No build tools. No frameworks. Vanilla JS + Canvas.
- Small files > clever abstractions.
- Deploy and test after every push.
- Relocate first, refactor logic later.
