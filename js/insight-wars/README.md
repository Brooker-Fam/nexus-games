# Insight Wars

Foundation layer for a single-player, turn-based PostHog-themed card game.

## Run

```sh
npm install
npm run dev
# open /insight-wars
```

## Test

```sh
npm test
```

## Stack

This repo is a vanilla JavaScript + HTML/CSS app served by Vercel. Existing games mount through `js/shared/game-registry.js`; Insight Wars follows that pattern under `js/insight-wars/`.

## Foundation scope

- Pure DOM-free game-state module: `game-state.mjs`.
- Browser placeholder/route entry: `game.js`.
- Route: `/insight-wars`.
- Shared action API for future UI and AI controller:
  - `playCard(cardInstanceId, target?)`
  - `attackWithMinion(minionId, target)`
  - `endTurn()`

## Card list

The bootstrap prompt referenced a fuller operator transcript, but that transcript was not present in this checkout. The known cards were implemented as specified, and the truncated/unknown cards were inferred to keep a complete 9-card foundation. Please override these effects in the UI/AI follow-up if the original transcript differs.

| Card | Cost | Type | Effect |
| --- | ---: | --- | --- |
| Feature Flag | 1 | Spell | Disable one enemy minion during its controller's next turn. |
| Session Replay | 2 | Spell | Reveal the AI hand for the player's current turn only; no-op when AI plays it. |
| A/B Test | 3 | Spell | 50/50: deal 5 damage to the enemy hero, or heal your hero for 5. |
| Funnel | 4 | Spell | Deal 2 damage to the enemy hero and 1 damage to each enemy minion. |
| Cohort | 3 | Minion | Summon a 2/3 Cohort minion. |
| Insight | 2 | Spell | Draw 2 cards. Inferred for the truncated card prompt. |
| Dashboard | 4 | Minion | Summon a durable 3/5 Dashboard minion. Inferred. |
| Survey | 2 | Spell | Heal your hero for 3 and draw 1 card. Inferred. |
| HogQL Query | 5 | Spell | Deal 4 damage to a chosen enemy target, or the enemy hero if no valid target is supplied. Inferred. |

## Deck composition

Both players use the same 23-card deck:

- 3× Feature Flag
- 2× Session Replay
- 3× A/B Test
- 2× Funnel
- 3× Cohort
- 3× Insight
- 2× Dashboard
- 3× Survey
- 2× HogQL Query

Each player draws 3 cards at game start. Event mana starts at 1 on turn 1, increases by 1 each active turn, caps at 10, and refills for the active player at turn start.
