<wizard-report>
# PostHog post-wizard report

The wizard has completed a full PostHog analytics integration for Nexus Games. PostHog is loaded via the HTML snippet in `index.html`, initialized from environment variables generated at build time by `scripts/generate-posthog-config.js`. Ten custom events were instrumented across both games (Void Fortress tower defense and Deep Space Ops RTS), covering game outcomes, player actions, multiplayer activity, and navigation — with rich properties on each event to support filtering, funnels, and breakdowns.

| Event | Description | File |
|---|---|---|
| `td_wave_started` | Player sends a wave of enemies in Void Fortress | `js/td/logic.js` |
| `td_tower_placed` | Player places a tower on the map (type, cost, wave, count) | `js/td/logic.js` |
| `td_game_ended` | Void Fortress game ends — outcome, wave reached, score, towers placed | `js/td/logic.js` |
| `td_game_restarted` | Player restarts Void Fortress after a game ends | `js/td/logic.js` |
| `dso_faction_selected` | Player selects a faction on the Deep Space Ops screen (singleplayer or multiplayer) | `js/init.js` |
| `dso_game_started` | Player begins a singleplayer Deep Space Ops battle | `js/init.js` |
| `dso_game_ended` | DSO game ends — outcome, factions, mode, rating before/after, streak | `js/rts/game.js` |
| `mp_game_hosted` | Player successfully creates a multiplayer room | `js/init.js` |
| `mp_game_joined` | Player successfully joins a multiplayer room | `js/init.js` |
| `game_tab_switched` | Player switches between Tower Defense and Deep Space Ops tabs | `js/init.js` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/380973/dashboard/1463276
- **DSO: Game Outcomes (Victory vs Defeat)**: https://us.posthog.com/project/380973/insights/gs9S9VNC
- **DSO: Faction Selection → Game Completion Funnel**: https://us.posthog.com/project/380973/insights/mU9S0RBc
- **DSO: Faction Popularity**: https://us.posthog.com/project/380973/insights/TbG4tb4U
- **Multiplayer: Games Hosted vs Joined**: https://us.posthog.com/project/380973/insights/9DPRldmE
- **Tower Defense: Game Outcomes (Victory vs Defeat)**: https://us.posthog.com/project/380973/insights/hh9SSrDZ

**Local development note:** Run `node scripts/generate-posthog-config.js` once after cloning to generate `js/posthog-config.js` locally (requires `POSTHOG_TOKEN` and `POSTHOG_HOST` set in your environment or `.env`). On Vercel, this runs automatically as the build command.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
