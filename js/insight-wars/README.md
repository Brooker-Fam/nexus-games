# Insight Wars foundation

Insight Wars is a single-player, turn-based card game skeleton for Nexus Games. This foundation PR sets up the game directory, deterministic state helpers, cards, an MVP tab UI, and unit tests so follow-up hoglets can add complete card effects, AI, UI polish, and broader coverage.

## How to run

```bash
npm install
npm run dev
```

Open the local Vercel dev URL, then either:

- click the **◬ Insight Wars** tab, or
- visit `/#insight-wars` directly.

Run tests with:

```bash
npm test
# or directly:
node --test js/insight-wars/*.test.js
```

## Renderer and repo fit

This repo is a vanilla JavaScript/Vercel app, not React/Vite. Existing games are mounted as tabs from `index.html` and registered through `js/shared/game-registry.js`, so Insight Wars follows the same pattern using `js/insight-wars/ui.js`.

## Starting rules

- Heroes: player and AI start at 20 HP.
- Opening hand size: 3 cards per side.
- Mana: player starts at 1/1; each started turn ramps max mana by 1, capped at 10, then refills.
- Board cap: 7 minions per side. Summons beyond the cap fizzle gracefully and the card still resolves/spends mana.
- Empty deck: drawing from an empty deck does nothing. Fatigue damage is out of scope.
- AI: placeholder only; it currently ends its turn without playing cards.
- Summoning sickness: minions created during a turn cannot attack until the start of their owner's next turn.
- Session Replay: player-cast reveals the AI hand through the AI's next turn; AI-cast intentionally spends events and does nothing.

## Deck composition

Both players use the same deterministic 21-card deck list before shuffling:

- 3x Feature Flag
- 3x Insight
- 3x Surveys
- 2x Session Replay
- 2x A/B Test
- 2x Funnel
- 2x Cohort
- 2x Heatmap
- 2x Experiment

`createInitialState(seed)` accepts a fixed seed for deterministic tests. The browser UI calls it without a seed, which uses `Date.now()`.

## Card definitions

| Card | Cost | Implemented effect text |
| --- | ---: | --- |
| Feature Flag | 1 | Disable one enemy minion next turn. |
| Session Replay | 2 | Reveal AI hand for 1 turn when played by the player; no-op for AI. |
| A/B Test | 3 | Summon a 2/3 A/B Test Variant minion. |
| Funnel | 4 | Summon a 4/4 Funnel minion. |
| Cohort | 3 | Summon a 3/2 Cohort minion. |
| Insight | 1 | Deal 2 damage to an enemy hero or enemy minion. |
| Surveys | 2 | Heal own hero 4, capped at 20. |
| Heatmap | 3 | Deal 3 damage to a target; AI auto-targets enemy hero. |
| Experiment | 5 | Summon a 5/5 Experiment minion. |

## Follow-up TODOs

Search for `TODO(insight-wars)` in `gameState.js` and `ui.js`. Known extension points:

- Replace the placeholder AI turn with greedy card play and attacks.
- Add complete target-picking UI for Feature Flag, Insight, and Heatmap.
- Improve Session Replay presentation.
- Add once-per-turn attack tracking if desired by the final ruleset.
