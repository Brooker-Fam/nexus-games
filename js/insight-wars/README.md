# Insight Wars

Single-player turn-based card game foundation for Nexus Games.

## Local run

This repo is a vanilla JS/Vercel app. From the repo root:

```sh
npm install
npm run dev
```

Navigate to `/insight-wars`.

Engine tests are game-local because the root repo had no test runner:

```sh
npm install --prefix js/insight-wars
npm test --prefix js/insight-wars
```

No PostHog SDK is wired in.

## Current scope

Done in this foundation slice:

- route/tab entry for `/insight-wars`
- framework-free engine state, deck, turn flow, draw, play-card, discard, and minion summoning infrastructure
- placeholder vanilla JS UI with New Game, End Turn, hero HP, mana, hand, boards, and log
- AI placeholder that auto-ends its turn

Intentionally left for follow-up hoglets:

- TODO(next-hoglet): real card resolve effects
- TODO(next-hoglet): AI controller
- TODO(next-hoglet): win/lose screen
- TODO(next-hoglet): UI polish, art, animations, and audio

## Placeholder deck composition

Cards are defined in `engine/deck.js`. Costs and counts are final for this scaffold; spell effects are TODO no-ops.

| Card | Cost | Type | Count | Stats |
| --- | ---: | --- | ---: | --- |
| Feature Flag | 1 | Spell | 3 | — |
| Session Replay | 2 | Spell | 2 | — |
| A/B Test | 3 | Spell | 2 | — |
| Funnel | 4 | Spell | 2 | — |
| Cohort | 3 | Minion | 3 | 2/3 |
| Insight | 1 | Spell | 3 | — |
| Surveys | 2 | Spell | 2 | — |
| Heatmap | 3 | Spell | 2 | — |
| Experiment | 5 | Minion | 2 | 5/5 |

Total: 21 cards per deck.
