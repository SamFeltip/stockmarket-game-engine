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

This repository is [SamFeltip/stockmarket-game-engine](https://github.com/SamFeltip/stockmarket-game-engine).
The [stockmarket GitHub Project](https://github.com/users/SamFeltip/projects/3) groups the four repositories.
It tracks `stockmarket-shared` and `stockmarket-ai` directly. The web game, TV app and original
Go/HTMX project are Git submodules pinned to compatible commits, retaining their own repositories
and histories. Additional local development worktrees remain ignored.

Clone the complete workspace (authentication is required for this private parent repository):

```sh
git clone --recurse-submodules https://github.com/SamFeltip/stockmarket-game-engine.git stockmarket
cd stockmarket
```

For an existing clone, run `git submodule update --init --recursive` after pulling. The submodules
initially use detached checkouts of the recorded commits; create a branch inside a submodule before
editing it. To update a dependency, publish its commit in its own repository, then commit its updated
submodule pointer here. Do not use `git submodule update --remote` to reproduce a pinned checkout.

Keep the sibling layout: consumers import shared TypeScript source directly. A checkout of the web
repository on its own is no longer sufficient. Feature-branch commits are pinned here; this does not
merge the existing applications' main branches or deploy either app.

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
