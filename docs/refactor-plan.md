# Nexus Games — Refactor Plan

## Approach
- Static site, no build step, no bundler, no npm
- Plain `<script>` tags loading separate JS files
- Vercel serves files as-is
- Each file should be a single clear responsibility, under ~500 lines ideally
- Extract and split incrementally — never rewrite logic, just move code

## Current File Structure
```
index.html            — HTML markup only (253 lines)
styles.css            — All CSS (622 lines)
js/audio.js           — Sound engine + SFX definitions (85 lines)
js/ui.js              — Particles + tab switching (27 lines)
js/tower-defense.js   — TD game: logic + rendering (992 lines)
js/faction-cards.js   — Faction character art + sidebar previews (577 lines)
js/rts-game.js        — RTS: state, camera, entities, AI, tick, loop (1260 lines)
js/rts-rendering.js   — RTS: environment, structures, projectiles drawing (822 lines)
js/rts-units.js       — RTS: worker/warrior/elite/wizard/tank drawing (1082 lines)
js/cinematic.js       — Faction reveal animation (105 lines)
js/init.js            — Bootstrap, screen navigation, faction data (62 lines)
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

## Next Steps

### Phase A: Break down large files
- [ ] Split tower-defense.js into td-logic.js (~500) + td-rendering.js (~500)
- [ ] Split rts-game.js into rts-entities.js (factory functions, entity types) + rts-logic.js (tick, AI, combat) + rts-camera.js (camera + input)
- [ ] Split rts-units.js into per-faction files or by unit tier (workers vs warriors vs elites)
- [ ] Split rts-rendering.js into rts-structures.js (building drawing) + rts-environment.js (background, gold, base, minimap)

### Phase B: Shared code cleanup
- [ ] Extract particle systems (both TD and RTS use similar patterns) into shared utils
- [ ] Pull hexAlpha and other tiny helpers into js/utils.js
- [ ] Centralize faction config (colors, names, stats) — currently scattered

### Phase C: Make it easy to add games
- [ ] Establish a pattern: each game is a folder (js/td/, js/rts/)
- [ ] Standardize game lifecycle (init, tick, draw, cleanup)
- [ ] Tab system should auto-discover or cleanly register games
- [ ] Adding a game = add folder + register in init

### Phase D: CSS organization
- [ ] Split styles.css into base.css (variables, reset, layout) + td.css + rts.css + components.css
- [ ] Each game's CSS lives with its game

## Principles
- No build tools. No frameworks. Vanilla JS + Canvas.
- Small files > clever abstractions.
- Every change must deploy and work. Test in prod after each push.
- Don't refactor logic — just relocate it. Logic changes come later.
