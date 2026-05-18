# Insight Wars

## Overview

Insight Wars is a single-player, turn-based card game being added to Nexus Games in layers. This foundation layer owns the pure game-state contract only: cards, decks, hero resources, turn flow, deterministic shuffling, win checks, and stubbed extension points for future card effects, minion combat, and AI.

Both sides start at 20 HP. The player begins turn 1 with 1/1 Events, while the AI starts at 0/0 Events until its first turn begins. Each side uses the same fixed 22-card deck and draws a 3-card opening hand from its independently shuffled deck.

## How to Run

<!-- TODO: UI hoglet -->

## Card Reference

| Card ID | Name | Cost | Effect |
|---|---|---:|---|
| `feature_flag` | Feature Flag | 1 | Disable one enemy minion's next attack. |
| `session_replay` | Session Replay | 2 | Reveal the AI hand for the current turn. |
| `ab_test` | A/B Test | 3 | 50/50: deal 5 damage to the enemy hero or heal 5 HP. |
| `funnel` | Funnel | 4 | Deal 2 damage to the enemy hero and 1 damage to each enemy minion. |
| `cohort` | Cohort | 3 | Summon a 2/3 Cohort minion. |
| `insight` | Insight | 1 | Draw a card. |
| `surveys` | Surveys | 2 | Heal 4 HP. |
| `heatmap` | Heatmap | 3 | Deal 4 damage to a single target. |
| `experiment` | Experiment | 5 | Summon a 5/5 Experiment minion. |

## Architecture

- `game-state.js` is the contract module. It exports JSDoc-documented types, `CARD_CATALOG`, `DECK_COMPOSITION`, `buildDeck()`, deterministic `shuffle()`, initial state creation, draw/turn/win helpers, and stubs for `canPlayCard()`, `playCard()`, `attackWith()`, and `runAiTurn()`.
- `game.js` is a minimal vanilla DOM placeholder that registers the Insight Wars tab and renders `Insight Wars (foundation only)`. The UI hoglet should replace this layer without moving game rules into the DOM.
- `game-state.test.js` covers only the foundation behavior implemented here. It uses seeded RNG injection so future tests can reproduce deck order and A/B randomness.

