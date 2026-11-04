# Shared Stockmarket engine

This is the single rules implementation used by the Convex game and `../stockmarket-ai`.
There are no runtime package dependencies or imports from Convex, React, or the web project.

- `src/shared`: price/cash settlement, quantities, company roles and card calculations.
- `src/engine`: dealing, legal moves, commands, turn/period progression, special decisions and observations.
- `src/packages/game-contracts`: portable action, observation and NPC memory types.
- `src/packages/npc-engine`: the existing NPC strategies, unchanged by this extraction.
- `src/catalog.ts`: the common original stock and insight data.

Game operations take a `MutationContext`: a typed `GameStore`, a random-number function, and
hooks for requesting the next NPC turn or finishing a Rights Issue presentation. The store port
supports keyed documents and a small set of indexed selections. It is not a dependency on a database
service. Existing asynchronous operations are retained to preserve live transaction behaviour;
the memory adapter resolves them without I/O.

The live `convex/engine.ts` adapter supplies Convex storage, its existing transactional randomness,
its scheduler and Convex-compatible errors. The live schema is checked against the portable
entities in both directions at compile time. API authentication and controller permissions remain
in the live app, outside the rules engine. The headless adapter provides rollback, explicit
seeded randomness, and immediate passage through presentation-only boundaries.

`convex/game`, `shared` and `packages` in the web app retain forwarding modules for existing
imports. Rule changes belong here; do not add a separate implementation in either consumer.
The NPC observation builder and automatic NPC choice adapters are shared too. The training
policy itself remains outside the game engine.

`npm ci && npm run check` checks the shared package independently. Imports use the sibling source
layout so every consumer runs the same code. Keep this repository revision coordinated with
the pinned web app when deploying; no live deployment is performed by these checks. See the root [setup guide](../SETUP.md),
[deployment guide](../DEPLOYMENT.md) and [rules comparison](docs/RULES_COMPARISON.md).

## Environment configuration

This package reads no environment variables and needs no `.env` file. Game configuration
is supplied through the engine API. Consumers own their persistence and service configuration.
