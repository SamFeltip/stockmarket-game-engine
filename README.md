# Stockmarket workspace

The current web game and the headless AI environment use one implementation of the game rules.

```text
stockmarket/
├── stockmarket-shared/   Shared rules, game lifecycle, contracts, catalog and existing NPC strategies
├── stockmarket-ai/       In-memory environment API and tests; no UI or learning algorithm
├── stockmarket-convex/   Existing React game and Convex persistence/auth/scheduling adapter
├── stockmarket-tv/       Existing TV application
└── stockmarket-old/      Original Go/templ/HTMX project (its existing Git repository is retained)
```

This parent repository tracks `stockmarket-shared` and `stockmarket-ai`. The web game and TV
retain their existing Git repositories; their directories and other existing worktrees are ignored here.
Keep the sibling layout: the consumers import shared TypeScript source directly, so there is no
second compiled or copied rules implementation. A checkout of the web repository on its own is
no longer sufficient. Other existing branches/worktrees retain their original implementation until
these extraction changes are merged into them.

The extraction uses the web working tree's existing rules as its baseline, including the already
present £500 cash rounding and £8 NatWest opening price. It introduces no rules migration.
Live database schema, endpoint arguments, authentication, animations and scheduling stay with the app.

See [shared engine](stockmarket-shared/README.md) and [headless API](stockmarket-ai/README.md).
No graphical or terminal training application is included.

## Checks

Node 22.18 or newer:

```sh
npm ci --prefix stockmarket-shared
npm run check --prefix stockmarket-shared
npm ci --prefix stockmarket-ai
npm run check --prefix stockmarket-ai
npm test --prefix stockmarket-ai
npm ci --prefix stockmarket-convex
npm run check --prefix stockmarket-convex
```

The headless tests require no dependency installation, credentials, environment variables or
running Convex service. Its dev dependencies are needed only for TypeScript checking.
The web integration tests replay the same seeded full game through Convex endpoints and the
in-memory adapter and compare financial state, roles, prices and card use after every decision.
