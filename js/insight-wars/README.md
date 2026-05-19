# Insight Wars

Insight Wars is a single-player, turn-based card game for Nexus Games. Max battles Dark Funnel PM using PostHog-flavored cards, deterministic state helpers, and a vanilla JavaScript renderer mounted into the existing Nexus Games tab UI.

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
```

## Renderer and repo fit

This repo is a vanilla JavaScript/Vercel app, not React/Vite. Existing games are mounted as tabs from `index.html` and registered through `js/shared/game-registry.js`, so Insight Wars follows the same pattern using `js/insight-wars/ui.js`.

## Starting rules

- Click **New Game** in the header at any time to start over. This resets both heroes to 20 HP, reshuffles both decks, redraws opening hands, clears boards, and returns the match to turn 1 with 1/1 mana.
- Heroes: Max (player) and Dark Funnel PM (AI) start at 20 HP.
- Opening hand size: 3 cards per side.
- Draw-per-turn: the active player draws 1 card at the start of each turn after the opening hands are dealt.
- Mana/events: player starts at 1/1; each started turn ramps max mana by 1, capped at 10, then refills. The UI shows the active player's `current/max` counter.
- Board cap: 7 minions per side. Summons beyond the cap are rejected gracefully and the card still resolves/spends mana in this foundation.
- Empty deck: drawing from an empty deck does nothing. Fatigue damage is out of scope.
- AI: placeholder only; it currently ends its turn without playing cards.

## Match UI and end screens

- Persistent status counters show Max HP, Dark Funnel PM HP, turn number, active side, active-side mana/events, and AI hand visibility.
- The **End Turn** button is enabled only during the player's turn. It remains visible but disabled during the AI turn and after the match ends.
- When Dark Funnel PM reaches 0 HP, interactions are blocked and a victory overlay appears: **"You won! Max defeated Dark Funnel PM."**
- When Max reaches 0 HP, interactions are blocked and a defeat overlay appears: **"You lost. Dark Funnel PM wins this funnel."**
- The overlay **New Game** button fully resets state and dismisses the end screen.

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

| Card | Cost | Foundation effect text |
| --- | ---: | --- |
| Feature Flag | 1 | Disable one enemy minion next turn. |
| Session Replay | 2 | Reveal AI hand for 1 turn when played by the player; no-op for AI. |
| A/B Test | 3 | 50/50: deal 5 damage to enemy hero OR heal own hero 5. |
| Funnel | 4 | Deal 2 damage to enemy hero + 1 damage to each enemy minion. |
| Cohort | 3 | Summon a 2/3 Cohort minion. |
| Insight | 1 | Draw a card. |
| Surveys | 2 | Heal own hero 4, capped at 20. |
| Heatmap | 3 | Deal 3 damage to a target; AI auto-targets enemy hero. |
| Experiment | 5 | Summon a 4/4 Experiment minion. |

## Follow-up TODOs

Search for `TODO(insight-wars)` in `gameState.js` and `ui.js`. Known extension points:

- Replace the placeholder AI turn with greedy card play and attacks.
- Add complete target-picking UI for Feature Flag and Heatmap.
- Improve Session Replay presentation and AI behavior.
- Polish A/B Test result messaging and animation.
- Add once-per-turn attack tracking if desired by the final ruleset.
