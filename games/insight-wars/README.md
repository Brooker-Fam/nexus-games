# Insight Wars

## Local setup

This game is scaffolded into the existing Nexus Games single-page arcade shell. From the repo root:

```bash
npm ci
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/index.html` and select the `INSIGHT WARS` tab.

For the repo's Vercel/serverless workflow, use `npm run dev` when the Vercel CLI is available and authenticated.

## Card reference (TBD)

Card types, costs, effects, and resolution rules will be added by later hoglets.

## Architecture (TBD)

This first stacked PR only adds a placeholder route and smoke-testable render entry. Game state, card logic, turn resolution, AI, and production UI components are intentionally TBD.
