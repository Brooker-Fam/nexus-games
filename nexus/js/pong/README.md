# Atari Pong

Core browser implementation lives in `js/pong/game.js`, with scoped styles in `css/pong.css` and tab integration in `index.html` / `js/init.js`.

Survey hook points are documented in the comment block at the top of `js/pong/game.js`. Programmatic PostHog survey modals live in `js/pong/surveys.js` and capture `survey shown`, `survey dismissed`, and `survey sent` events.

See `docs/pong/DISCOVERY.md` for the repo/game structure notes.

## PostHog surveys

| Survey | `survey_id` | Trigger | Response |
| --- | --- | --- | --- |
| Post-game enjoyment | `survey_pong_postgame_enjoyment` | Game-over screen after every completed Pong game | Rating 1–5 |
| First-visit discovery | `survey_pong_first_visit_discovery` | Welcome/mode-select screen the first time a player visits Pong, guarded by `localStorage.pong_visited` | Single choice: GitHub, Friend, Search, Other |
| Mode preference reason | `survey_pong_mode_preference` | Immediately after selecting single-player or two-player mode, once per browser session | Open text |
| Difficulty satisfaction | `survey_pong_difficulty_satisfaction` | After 3+ completed single-player games in a browser session, tracked with `sessionStorage.pong_single_player_games_completed` | Rating 1–5 plus optional comment |
| General feedback / feature requests | `survey_pong_general_feedback` | Once per browser session when idle on a Pong menu for 60+ seconds or when pausing gameplay | Open text |

The site initializes PostHog from `window.POSTHOG_TOKEN` / `window.POSTHOG_KEY` with a placeholder fallback (`posthog_project_api_key_placeholder`) and `api_host: 'https://us.i.posthog.com'`. Replace the placeholder through the generated `js/posthog-config.js` or another runtime config before production use.
