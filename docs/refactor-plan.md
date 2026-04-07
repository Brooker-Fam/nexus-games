# Nexus Games — Refactor Plan

## Approach
- Static site, no build step, no bundler, no npm
- Plain `<script>` tags loading separate JS files
- Vercel serves files as-is
- Each file: single responsibility, under ~500 lines
- Extract and split incrementally — never rewrite logic, just move code

## File Structure
```
index.html                 — HTML markup (267 lines)
styles.css                 — All CSS (622 lines)

js/shared/audio.js         — Sound engine + SFX definitions (85)
js/shared/ui.js            — Particles + tab switching (27)

js/td/logic.js             — TD: state, enemies, towers, game loop (335)
js/td/towers.js            — TD: tower drawing (gun, laser, missile, cryo) (377)
js/td/rendering.js         — TD: background, path, enemies, bullets, particles (280)

js/rts/camera.js           — RTS: state vars, camera, input (129)
js/rts/entities.js         — RTS: faction config, entity factories, startRTS (262)
js/rts/ui.js               — RTS: build popup, click handling, HUD (357)
js/rts/game.js             — RTS: AI, tick, combat, projectiles, game loop (512)
js/rts/rendering.js        — RTS: draw orchestration, minimap, background (200)
js/rts/structures.js       — RTS: base, temple, structures, cannons (622)
js/rts/faction-cards.js    — Faction character art + sidebar previews (577)
js/rts/workers.js          — RTS: worker drawing per faction (247)
js/rts/warriors.js         — RTS: warrior + projectile drawing (425)
js/rts/elites.js           — RTS: elite, wizard, necromancer, tank (410)
js/rts/cinematic.js        — Faction reveal animation (105)

js/init.js                 — Bootstrap, screen nav, faction data (62)
```

## Completed
- [x] Extract CSS into styles.css
- [x] Extract audio/SFX engine
- [x] Extract particles + tab switching
- [x] Extract tower defense game
- [x] Extract faction card art + previews
- [x] Extract RTS engine
- [x] Split all files under ~625 lines
- [x] Move all inline JS out of index.html
- [x] Organize into game folders (js/td/, js/rts/, js/shared/)

## Next Steps

### Phase B: Shared code cleanup
- [ ] Centralize faction config (FACTION_CFG in entities.js + FACTION_DATA in init.js → one file)
- [ ] Move dso* state vars into a shared RTS state object
- [ ] Extract shared particle helpers

### Phase C: Standardize game lifecycle
- [ ] Each game exports: init(), cleanup()
- [ ] Tab switching calls cleanup() on old game, init() on new
- [ ] Adding a game = add folder + register in init.js

### Phase D: CSS split
- [ ] Split styles.css into base.css + td.css + rts.css

## Principles
- No build tools. No frameworks. Vanilla JS + Canvas.
- Small files > clever abstractions.
- Deploy and test after every push.
- Relocate first, refactor logic later.
