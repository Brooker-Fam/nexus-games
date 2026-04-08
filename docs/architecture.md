# Nexus Games — Architecture

## How to use this doc

This doc has two kinds of content:

**Evergreen reference** — keep accurate as the codebase evolves:
- Overview, Tech Stack, Hosting, File Structure, Design Principles, Architecture Patterns

**Tracking sections** — ephemeral, clean up as work gets done:
- **Technical Debt** — delete rows when fixed, don't check them off
- **Roadmap** — delete items when shipped; collapse a phase once it's empty

If a tracking item becomes stale or irrelevant, just remove it.
The goal is a short, current document — not a changelog.

---

## Overview

Two-game static site: **Void Fortress** (tower defense) and **Deep Space Ops** (RTS).
Vanilla JavaScript + Canvas 2D. No frameworks, no npm, no build step.
Deployed to Vercel as static files (~255KB total, ~90KB gzipped).

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | Vanilla JS (ES2020+) | No build step, instant deploys, zero dependencies |
| Rendering | Canvas 2D API | Procedural graphics — all visuals drawn at runtime, no image assets |
| Audio | Web Audio API | Procedural synthesis — 28+ SFX generated in-browser, no audio files |
| Fonts | Google Fonts CDN | Orbitron + Rajdhani, loaded conditionally (skipped on `file://`) |
| Hosting | Vercel static | Free tier, global edge CDN, <50ms TTFB, no compute costs |
| VCS | Git + GitHub | No CI/CD configured yet |

## Hosting

Vercel static is the right fit. The entire site is smaller than a single hero image.
Multiplayer uses PeerJS WebRTC (peer-to-peer), so no server-side logic is needed.

**Alternatives evaluated**:
- Cloudflare Pages — comparable, but no reason to migrate
- S3 + CloudFront — more config overhead for no benefit at this scale
- Adding a bundler (Vite/esbuild) — saves ~70KB via minification, not worth the complexity yet; revisit at ~30 files or when real asset files appear

## File Structure

```
index.html                     — Single-page markup (278 lines)

css/
  base.css                     — Variables, reset, layout, header, tabs
  td.css                       — Tower defense styles
  rts.css                      — Deep Space Ops styles

js/
  init.js                      — Bootstrap, event delegation, game lifecycle
  shared/
    audio.js                   — Web Audio synth engine + SFX definitions
    ui.js                      — Background particles, tab switching
  td/
    logic.js                   — State, config, enemies, towers, game loop
    towers.js                  — Tower drawing (gun, laser, missile, cryo)
    rendering.js               — Background, path, enemies, bullets, particles
  rts/
    factions.js                — FACTION_CFG, FACTION_DATA, faction state
    commands.js                — Command queue (decouples input from simulation)
    faction-cards.js           — Character art + selection screen
    camera.js                  — S state object, camera, world/screen transforms, input
    entities.js                — Entity factories, startRTS()
    draw-helpers.js            — Shared drawing (health bars, selection rings)
    ui.js                      — Build popup, click handling, HUD
    game.js                    — AI, tick loop, combat, projectiles
    multiplayer.js             — PeerJS WebRTC — host/guest, state sync
    rendering.js               — Draw orchestration, minimap, background
    structures.js              — Base, temple, faction structures, cannons
    workers.js                 — Worker drawing per faction
    warriors.js                — Warrior + basic projectile drawing
    elites.js                  — Elite unit variants per faction
    cinematic.js               — Faction reveal animation

docs/
  architecture.md              — This file
  multiplayer-redesign.md      — Multiplayer architecture notes
```

**Guideline**: Each file stays under ~600 lines with a single responsibility.

## Design Principles

- No build tools. No frameworks. Vanilla JS + Canvas.
- Small files > clever abstractions.
- Config-driven: faction behavior defined in `FACTION_CFG`, not scattered conditionals.
- Command pattern: player actions go through a command queue (multiplayer-ready).
- Procedural everything: zero static assets, all graphics/audio generated at runtime.
- Deploy and test after every push.

## Architecture Patterns

### State Management
- **TD**: Single `state` object in `td/logic.js` (gold, lives, towers, enemies, etc.)
- **RTS**: Centralized `S` object in `camera.js` — game flow, entities, resources, AI, camera, UI state. `resetRtsState()` restores all defaults for clean init/teardown.
- **Command queue** (`commands.js`): All player mutations flow through `issueCommand()` / `processCommands()`. Commands carry `type`, `side`, `tick` — ready for network broadcast.

### Rendering Pipeline
- **TD**: `drawBg()` → `drawPath()` → `drawTowers()` → `drawEnemies()` → `drawBullets()` → `drawParticles()`
- **RTS**: Clear → camera transform → terrain → gold nodes → structures → cannons → workers → warriors → projectiles → particles → restore → minimap → HUD
- Both use `requestAnimationFrame` with fixed-timestep accumulators (16.67ms per tick).

### AI System (RTS)
- Decision loop on fixed interval (~4s ticks)
- Counts own units, evaluates threats, builds/attacks accordingly
- Uses same command queue as player (important for multiplayer parity)

### Multiplayer (RTS)
- PeerJS WebRTC — peer-to-peer, no dedicated server
- Host-authoritative model: host runs simulation, guest receives state sync
- Delta compression on state sync at ~10fps
- Short 4-char room codes for joining
- Guest input sent as commands to host

## Known Technical Debt

### Should fix soon

| Issue | Where | Impact |
|-------|-------|--------|
| All scripts load upfront | `index.html` | Both games load even when only one is played (~130KB wasted) |

### Can wait

| Issue | Where | Impact |
|-------|-------|--------|
| `Array.shift()` for trails | `td/logic.js` | O(n) per call; circular buffer would be better at scale |
| No minification | deployment | ~70KB savings; negligible until traffic matters |
| No linting | project-wide | Fine at current size; add ESLint when team grows or codebase hits ~8K LOC |
| No tests | project-wide | Command system especially would benefit from unit tests |
| O(n) entity targeting | `td/logic.js`, `game.js` | Fine under ~100 entities; spatial hash needed beyond that |

### Not worth fixing

- No TypeScript — codebase is small enough that vanilla JS is fine
- No framework — Canvas games don't benefit from DOM frameworks
- No asset pipeline — there are no assets to optimize
- Accessibility — limited applicability for Canvas games; keyboard nav for menus is the practical ceiling

## Roadmap

### Future
- [ ] Add touch support for mobile play
- [ ] Add more games (lifecycle system makes this plug-and-play)
- [ ] Consider bundler if file count exceeds ~30
- [ ] Leaderboards / persistence (would need a backend or edge DB)
