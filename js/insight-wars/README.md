# Insight Wars

Single-player turn-based card duel for Nexus Games. Play against the greedy **Dark Funnel PM** with PostHog-inspired spells and minions.

## Local setup

From the repo root:

```sh
npm install --prefix js/insight-wars
npm test --prefix js/insight-wars
npm run build --prefix js/insight-wars
npm run dev --prefix js/insight-wars
```

Then open `/insight-wars` on the printed local server URL. The root app also exposes the game as the Insight Wars tab/route.

No PostHog SDK is imported or initialized by this game package.

## Implemented scope

- route/tab entry for `/insight-wars`
- framework-free engine state, deck, turn flow, draw, play-card, discard, targeting, and minion summoning
- mana/events ramp to `min(turnNumber, 10)` with a hard cap at 10
- 9 unique card definitions with implemented effects and effect text
- minion combat with summoning sickness, one attack per turn, reciprocal minion damage, and Feature Flag disables
- greedy AI opponent wired into `endTurn()` through the Dark Funnel PM controller
- AI Heatmap targets the player hero, AI Session Replay is a no-op, and AI turns are guarded to avoid hanging
- win/lose detection on damage resolution plus a New Game win/lose overlay
- PostHog orange/yellow and dark gray themed UI polish

## Greedy AI behavior

The Dark Funnel PM plays the highest-cost affordable card first (ties use hand order), picks deterministic targets, treats Session Replay as a no-op, then attacks the player hero with every eligible minion. AI turns are synchronous and guarded to complete within 2 seconds.

## Deck composition

Cards are defined in `engine/deck.js`. Each deck has 21 cards total.

| Card | Cost | Type | Count | Effect |
| --- | ---: | --- | ---: | --- |
| Feature Flag | 1 | Spell | 3 | Disable an enemy minion for its next turn. |
| Session Replay | 2 | Spell | 2 | Reveal the AI hand this turn; AI gets no benefit. |
| A/B Test | 3 | Spell | 2 | 50/50: deal 5 to the enemy hero or heal your hero for 5. |
| Funnel | 4 | Spell | 2 | Deal 2 to the enemy hero and 1 to all enemy minions. |
| Cohort | 3 | Minion | 3 | Summon a 2/3 minion with summoning sickness. |
| Insight | 1 | Spell | 3 | Draw 1 card. |
| Surveys | 2 | Spell | 2 | Heal your hero for 4 HP. |
| Heatmap | 3 | Spell | 2 | Deal 4 damage to any chosen target. |
| Experiment | 5 | Minion | 2 | Summon a 5/5 minion with summoning sickness. |
