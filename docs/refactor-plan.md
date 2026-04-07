# Nexus Games — Refactor Plan

## Approach
- Static site, no build step, no bundler, no npm
- Plain `<script>` tags loading separate JS files
- Vercel serves files as-is
- Each file should be a single clear responsibility, under ~500 lines ideally
- Extract and split incrementally — never rewrite logic, just move code

## Current File Structure
```
index.html              — HTML markup only (256 lines)
styles.css              — All CSS (622 lines)
js/audio.js             — Sound engine + SFX definitions (85 lines)
js/ui.js                — Particles + tab switching (27 lines)
js/tower-defense.js     — TD: state, logic, game loop (335 lines)
js/td-rendering.js      — TD: all drawing (657 lines)
js/faction-cards.js     — Faction character art + sidebar previews (577 lines)
js/rts-camera.js        — RTS: state vars, camera system (129 lines)
js/rts-entities.js      — RTS: faction config, entity factories, startRTS (262 lines)
js/rts-ui.js            — RTS: build popup, click handling, HUD (357 lines)
js/rts-game.js          — RTS: AI, tick, combat, projectiles, game loop (512 lines)
js/rts-rendering.js     — RTS: environment, structures, cannons, minimap (822 lines)
js/rts-workers.js       — RTS: worker drawing per faction (247 lines)
js/rts-warriors.js      — RTS: warrior drawing + projectile drawing (425 lines)
js/rts-elites.js        — RTS: elite, wizard, necromancer, tank drawing (410 lines)
js/cinematic.js         — Faction reveal animation (105 lines)
js/init.js              — Bootstrap, screen navigation, faction data (62 lines)
```

## Completed
- [x] Extract CSS into styles.css
- [x] Extract audio/SFX engine
- [x] Extract particles + tab switching
- [x] Extract tower defense game
- [x] Extract faction card art + previews
- [x] Extract RTS engine (logic)
- [x] Split RTS rendering from logic
- [x] Split RTS unit drawing from environment drawing
- [x] Extract cinematic reveal animation
- [x] Move all inline JS out of index.html
- [x] Split tower-defense.js into logic + td-rendering.js
- [x] Split rts-game.js into camera, entities, UI, game logic
- [x] Split rts-units.js into workers, warriors, elites

## Next Steps

### Phase A: Break down remaining large files
- [ ] Split rts-rendering.js (822) — structures/cannons vs environment/minimap
- [ ] Split td-rendering.js (657) — tower drawing vs effects/bullets/background
- [ ] Split faction-cards.js (577) — per-faction character art into separate files

### Phase B: Shared code cleanup
- [ ] Centralize faction config (FACTION_CFG + FACTION_DATA) into one file
- [ ] Extract shared particle spawn patterns into utils
- [ ] Move dso* state vars (dsoSelectedFaction, dsoRevealFrame, etc.) into a single place

### Phase C: Game folder structure
- [ ] Move TD files into js/td/ folder
- [ ] Move RTS files into js/rts/ folder
- [ ] Standardize game lifecycle (init, tick, draw, cleanup)
- [ ] Tab system registers games cleanly
- [ ] Adding a game = add folder + register in init

### Phase D: CSS organization
- [ ] Split styles.css into base.css + td.css + rts.css + components.css
- [ ] Each game's CSS lives alongside its JS

## Principles
- No build tools. No frameworks. Vanilla JS + Canvas.
- Small files > clever abstractions.
- Every change must deploy and work. Test in prod after each push.
- Don't refactor logic — just relocate it. Logic changes come later.
