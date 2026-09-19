# PostHog Pong surveys setup handoff

This project already identifies its PostHog project as `380973` on `https://us.posthog.com` in `posthog-setup-report.md`. The runtime client token/host are generated from `POSTHOG_TOKEN` and `POSTHOG_HOST`, but creating surveys requires a **personal API key** with survey management scopes.

## Why this handoff exists

The available `POSTHOG_PERSONAL_API_KEY` could list surveys, but the create call failed with:

```text
API key missing required scope 'survey:write'
```

Provide a personal API key with at least:

- `survey:read`
- `survey:write`

## Required environment variables

```sh
export POSTHOG_PERSONAL_API_KEY="phx_..." # Personal API key with survey:read and survey:write
export POSTHOG_PROJECT_ID="380973"
export POSTHOG_API_HOST="https://us.posthog.com"
```

If this project is moved to EU cloud, set `POSTHOG_API_HOST="https://eu.posthog.com"` instead.

## Surveys to create

Create exactly these five active API/custom surveys. Do not link a feature flag; the Pong client code triggers rendering via `posthog.renderSurvey` / `posthog.getActiveMatchingSurveys`.

| Name | Type | Question | Trigger |
| --- | --- | --- | --- |
| `pong_post_game_enjoyment` | `api` | Rating 1-5: “How much did you enjoy that match?” | Shown when client calls `posthog.renderSurvey` after game-over. |
| `pong_first_visit_discovery` | `api` | Single choice: “How did you discover Pong?” Options: Friend, Repo browsing, Social, Other. | First-visit on welcome screen. |
| `pong_mode_preference_reason` | `api` | Open text: “Why did you pick this mode?” | After mode selection. |
| `pong_difficulty_satisfaction` | `api` | Rating 1-5: “Was the AI difficulty about right?” | Return-to-menu after multiple rounds. |
| `pong_general_feedback` | `api` | Open text: “Any feedback or feature requests?” | Pause/idle. |

## Create commands

Run these from any shell with the environment variables above set.

```sh
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BASE_URL="${POSTHOG_API_HOST%/}/api/projects/${POSTHOG_PROJECT_ID}/surveys/"
AUTH_HEADER="Authorization: Bearer ${POSTHOG_PERSONAL_API_KEY}"

curl -sS -X POST "$BASE_URL" \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d @- <<JSON
{
  "name": "pong_post_game_enjoyment",
  "description": "Pong trigger: shown when client calls posthog.renderSurvey after game-over.",
  "type": "api",
  "schedule": "always",
  "start_date": "$NOW",
  "archived": false,
  "linked_flag_id": null,
  "conditions": {},
  "questions": [
    {
      "id": "enjoyment_rating",
      "type": "rating",
      "question": "How much did you enjoy that match?",
      "display": "number",
      "scale": 5,
      "lowerBoundLabel": "Not much",
      "upperBoundLabel": "Loved it",
      "optional": false,
      "buttonText": "Submit"
    }
  ]
}
JSON

curl -sS -X POST "$BASE_URL" \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d @- <<JSON
{
  "name": "pong_first_visit_discovery",
  "description": "Pong trigger: first-visit on welcome screen.",
  "type": "api",
  "schedule": "always",
  "start_date": "$NOW",
  "archived": false,
  "linked_flag_id": null,
  "conditions": {},
  "questions": [
    {
      "id": "discovery_source",
      "type": "single_choice",
      "question": "How did you discover Pong?",
      "choices": ["Friend", "Repo browsing", "Social", "Other"],
      "hasOpenChoice": true,
      "shuffleOptions": false,
      "optional": false,
      "buttonText": "Submit"
    }
  ]
}
JSON

curl -sS -X POST "$BASE_URL" \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d @- <<JSON
{
  "name": "pong_mode_preference_reason",
  "description": "Pong trigger: after mode selection.",
  "type": "api",
  "schedule": "always",
  "start_date": "$NOW",
  "archived": false,
  "linked_flag_id": null,
  "conditions": {},
  "questions": [
    {
      "id": "mode_reason",
      "type": "open",
      "question": "Why did you pick this mode?",
      "optional": false,
      "buttonText": "Submit"
    }
  ]
}
JSON

curl -sS -X POST "$BASE_URL" \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d @- <<JSON
{
  "name": "pong_difficulty_satisfaction",
  "description": "Pong trigger: return-to-menu after multiple rounds.",
  "type": "api",
  "schedule": "always",
  "start_date": "$NOW",
  "archived": false,
  "linked_flag_id": null,
  "conditions": {},
  "questions": [
    {
      "id": "difficulty_rating",
      "type": "rating",
      "question": "Was the AI difficulty about right?",
      "display": "number",
      "scale": 5,
      "lowerBoundLabel": "Too easy",
      "upperBoundLabel": "Too hard",
      "optional": false,
      "buttonText": "Submit"
    }
  ]
}
JSON

curl -sS -X POST "$BASE_URL" \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d @- <<JSON
{
  "name": "pong_general_feedback",
  "description": "Pong trigger: pause/idle.",
  "type": "api",
  "schedule": "always",
  "start_date": "$NOW",
  "archived": false,
  "linked_flag_id": null,
  "conditions": {},
  "questions": [
    {
      "id": "general_feedback",
      "type": "open",
      "question": "Any feedback or feature requests?",
      "optional": false,
      "buttonText": "Submit"
    }
  ]
}
JSON
```

## Verify commands

After creating the surveys, run:

```sh
curl -sS "$BASE_URL?limit=200" \
  -H "$AUTH_HEADER" \
  | node -e '
const fs = require("fs")
const data = JSON.parse(fs.readFileSync(0, "utf8"))
const required = new Set([
  "pong_post_game_enjoyment",
  "pong_first_visit_discovery",
  "pong_mode_preference_reason",
  "pong_difficulty_satisfaction",
  "pong_general_feedback",
])
const rows = (data.results || [])
  .filter((survey) => required.has(survey.name))
  .map((survey) => ({
    id: survey.id,
    name: survey.name,
    type: survey.type,
    start_date: survey.start_date,
    archived: survey.archived,
    linked_flag_id: survey.linked_flag_id,
  }))
console.table(rows)
const bad = rows.filter((survey) => survey.type !== "api" || !survey.start_date || survey.archived || survey.linked_flag_id !== null)
if (rows.length !== required.size || bad.length) process.exit(1)
'
```

Expected result: five rows, each with `type: "api"`, non-null `start_date`, `archived: false`, and `linked_flag_id: null`.
