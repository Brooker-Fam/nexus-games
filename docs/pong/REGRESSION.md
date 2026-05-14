# Atari Pong index integration regression sweep

Date: 2026-05-14  
Branch: `game-index-pong-regression`  
Base: `main` after PR #85 (`docs/pong-discovery`) was merged

## Pong registration points

Pong is registered as a tab-based game shell, matching the existing Nexus Games convention from `docs/pong/DISCOVERY.md`:

- `index.html`
  - CSS link: `css/pong.css`
  - Tab button: `#tab-btn-pong`
  - Tab content panel: `#tab-pong`
  - Canvas placeholder: `#pongCanvas`
  - Script tag: `js/pong/game.js`
- `js/init.js`
  - Tab click handler calls `switchTab('pong', this)`.
- `css/pong.css`
  - Pong shell styles scoped to `#tab-pong` / `.pong-*`.
- `js/pong/game.js`
  - Placeholder lifecycle only: `registerGame('pong', { init, cleanup })`.
  - No Pong gameplay, scoring, AI, survey, or analytics logic is implemented here.

The agreed Pong entry point for the core gameplay hoglet is `js/pong/game.js`, with DOM IDs `tab-pong` and `pongCanvas`.

## Verification commands

```bash
npm ci
npm test --if-present
npm run build
python3 -m http.server 4173 --bind 127.0.0.1
curl -I http://127.0.0.1:4173/index.html
```

A temporary local Playwright smoke script was also run against `http://127.0.0.1:4173/index.html` after installing Chromium dependencies in the runner. The script was not committed because the repo has no test harness or Playwright dependency.

## Existing game smoke checks

| Pre-existing game | Smoke check | Status | Notes |
| --- | --- | --- | --- |
| Void Fortress / Tower Defense | Load default active tab, place a Gun tower on the canvas, click `SEND WAVE`. | PASS | Wave advanced to `1`; gold dropped from `200` to `150`. |
| Deep Space Ops | Open tab, select Shadow Armada, click `BEGIN BATTLE`. | PASS | RTS game panel displayed (`#dso-game` became `display: block`). |
| Nexus Snake | Open tab, send `ArrowRight`, click 2× speed. | PASS | Snake tab stayed active; 2× speed button became active; length remained readable. |
| Fish Frenzy | Open tab and move mouse over the canvas. | PASS | Fish tab stayed active; canvas was present; size HUD remained readable. |

`Make Exception` is intentionally not listed as a game; it is a diagnostic tab that throws an exception for PostHog exception-capture testing.

## Pong shell smoke check

| New shell | Smoke check | Status | Notes |
| --- | --- | --- | --- |
| Atari Pong | Open `ATARI PONG` tab. | PASS | `#tab-pong` became active and placeholder status changed to `READY`. |

## Regression risks / notes

- **Known pre-existing local PostHog guard issue:** during static-server smoke testing without a real PostHog token, existing game interactions emit `posthog.capture is not a function` page errors because existing guards check only `window.posthog`. This PR does not change shared PostHog behavior or add Pong analytics/survey calls, per scope. The survey hoglet should use a callable-method guard when adding Pong surveys.
- **Expected static-server API 404s:** `python3 -m http.server` does not emulate Vercel API routes, so `/api/session` and `/api/stats?game=rts` return 404 in static smoke mode. This matches the discovery doc and does not block game rendering/interactions.
- **CSS bleed risk minimized:** new Pong CSS is scoped under `#tab-pong` / `.pong-*` except for intentional reuse of shared layout classes.
- **Global collision risk minimized:** new placeholder JS globals use `pong` / `PONG_` prefixes only.
- **Follow-up likely:** once the Pong-core branch lands, it may replace the placeholder internals in `js/pong/game.js` while preserving `registerGame('pong', ...)`, `#tab-pong`, and `#pongCanvas`.
