# Insight Wars

Insight Wars is a single-player, turn-based card game in the Nexus Games arcade. Max the Hedgehog (the player) duels the Dark Funnel PM (AI) with product-analytics themed cards, Events as mana, and small minions that can pressure the opposing hero.

## How to Run

This repo is a vanilla JavaScript frontend served by Vercel dev tooling.

```bash
npm install
npm run dev
```

Open the local Vercel URL, then choose the **Insight Wars** tab. The UI is mounted at the existing `#insight-wars-root` tab entry; no PostHog SDK, persistence, backend, card art, sound, or animation libraries are used.

## UI Layer

- `game.js` mounts the vanilla DOM GameBoard and wires New Game, card play, targeting, minion attacks, End Turn, AI turn pacing, Escape-to-cancel, and cleanup.
- `components.js` contains the named UI components: `GameBoard`, `HeroPanel`, `MinionCard`, `HandCard`, `ManaCounter`, `EndTurnButton`, and `WinLoseScreen`.
- `view-model.js` adapts Pawel's foundation state shape for rendering without owning game rules.
- `styles.css` provides the PostHog-inspired orange/yellow player side and muted grey AI side.

Game rules remain owned by `game-state.js` and Julian's effects/AI module when it lands.

## Card Reference

| Name | Cost | Effect | Copies per deck |
|---|---:|---|---:|
| Feature Flag | 1 | Disable one enemy minion's next attack. | 3 |
| Session Replay | 2 | Reveal the AI hand for the current turn. | 2 |
| A/B Test | 3 | 50/50: deal 5 damage to the enemy hero or heal 5 HP. | 2 |
| Funnel | 4 | Deal 2 damage to the enemy hero and 1 damage to each enemy minion. | 2 |
| Cohort | 3 | Summon a 2/3 Cohort minion. | 3 |
| Insight | 1 | Draw a card. | 3 |
| Surveys | 2 | Heal 4 HP. | 2 |
| Heatmap | 3 | Deal 4 damage to a single enemy target. | 3 |
| Experiment | 5 | Summon a 5/5 Experiment minion. | 2 |
