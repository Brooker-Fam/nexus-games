# Atari Pong

Core browser implementation lives in `js/pong/game.js`, with scoped styles in `css/pong.css` and tab integration in `index.html` / `js/init.js`.

Survey hook points are documented in the comment block at the top of `js/pong/game.js`. `js/pong/surveys.js` loads before the game script so it can catch the first-visit event emitted during game startup.

See `docs/pong/DISCOVERY.md` for the repo/game structure notes.

## PostHog Surveys

`js/pong/surveys.js` listens for the core game contract:

```js
window.dispatchEvent(new CustomEvent('pong:event', {
  detail: { type: 'game_over' } // plus any event-specific fields below
}))
```

The surveys module is silent unless `POSTHOG_TOKEN` is present in `js/posthog-config.js` and `window.posthog` is initialized. Missing PostHog env vars should produce no Pong survey UI and no runtime errors.

Create these five surveys in PostHog as active **API/custom surveys**. Use the stable key as the survey name, or include it in the survey name/description so the runtime can match it. Do not add PostHog event-trigger display conditions for these surveys; the Pong DOM events below are the trigger source. URL/device/feature-flag targeting is fine.

| Survey | Stable survey key/name | Pong trigger | Question schema |
| --- | --- | --- | --- |
| Post-game enjoyment | `pong_post_game_enjoyment` | `pong:event` with `detail.type === "game_over"` | Q1 rating, 1–5: “How much did you enjoy that match?”; Q2 optional open text: “Anything you want to add?” |
| First-visit discovery | `pong_first_visit_discovery` | `pong:event` with `detail.type === "first_visit"` | Single choice: “How did you find this game?” Choices: `friend`, `social`, `search`, `other` |
| Mode preference reason | `pong_mode_preference_reason` | `pong:event` with `detail.type === "mode_selected"` and optional `mode`/`player_mode`/`playerMode` | Short text: “Why did you choose {1P/2P}?” |
| Difficulty satisfaction | `pong_difficulty_satisfaction` | `pong:event` with `detail.type === "returned_to_menu"` and `rounds_played >= 2` (or `roundsPlayed >= 2`) | Single choice: “How was the difficulty?” Choices: `too_easy`, `just_right`, `too_hard` |
| General feedback | `pong_general_feedback` | `pong:event` with `detail.type === "pause_or_idle"` | Long text: “Any feedback or feature requests?” |

Runtime behavior:

- Surveys render as a small bottom-right toast with close and “Not now” buttons, so gameplay is not blocked.
- Only one Pong survey is shown at a time; additional trigger events queue behind the current toast.
- Dismissing or submitting a survey captures PostHog’s standard `survey dismissed` / `survey sent` events with `$survey_id`, `$survey_name`, `$survey_questions`, and `pong_survey_key`.
- For local testing, set `POSTHOG_TOKEN` and `POSTHOG_HOST`, run `npm run build` to regenerate `js/posthog-config.js`, then dispatch the `pong:event` examples above from the browser console.
