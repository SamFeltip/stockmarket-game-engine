# Headless Stockmarket environment

A separate TypeScript codebase using `../stockmarket-shared`. There is no GUI, terminal training
application, optimiser, model framework, or dependency on the web app or Convex. All game actions,
dealing and settlement call the shared engine used by the live game.

See the root [setup guide](../SETUP.md) for workspace installation and checks.

## API

```ts
import { GameEnvironment } from "./src/index";

const environment = await GameEnvironment.create({ seed: 42, players: 4, periods: 6 });
let result = await environment.current();

// Hand result.decision to your policy; then apply its action with that decision's token.
if (result.decision?.phase === "trading") {
    result = await environment.step({ kind: "pass" }, result.decision.token);
}
```

Each result contains `decision`, `finished` and per-player `rewards`. Rewards are zero during play
and final wealth at termination; custom objectives belong in the training code. Multiple agents
are controlled explicitly: use the returned `playerId` to select the next policy. Agents occupy
normal externally controlled seats; they are not automatically advanced by the live NPC scheduler.
The optional `npcAction` helper runs the existing NPCs as baseline opponents and returns updated
memory. Callers own that memory and commit it only after a successful step.

Decision phases:

| Phase | Action | Information |
| --- | --- | --- |
| `trading` | Existing buy/sell/pass/loan/debenture/rights actions | Filtered NPC observation and own card records |
| `rights` | `{ kind: "rights-response", quantity }` | Entitlement, supply, unit price and own cash |
| `suspension` | `{ kind: "suspend", stockKey? }` | Public settlement forecast and eligible stocks; omit stock to skip |
| `hold-stock` | `{ kind: "hold-stock", stockKey? }` | Legacy imported hold-stock decisions |

`observation.legalActions` lists ordinary legal trades. `chanceOffers` supplies the existing NPC's
beneficial card candidates, not an exhaustive list of all possible card activations. `ownCards`
includes IDs, kinds, period and used/resolved flags for the acting player's cards, including prior
periods; an agent can propose other card choices and the shared engine validates them.
Rights purchases accept any whole number within entitlement, cash and available supply, as in
live play. A token guards against stale decisions. Rejected commands roll back all writes and RNG
state. One environment accepts one operation at a time; use independent instances for parallel games.

`current()` and successful `step()` immediately advance completed Rights Issues and period
boundaries until another player must decide. This removes presentation timing and host button
presses, while retaining every financial rule and special-card choice. It never waits for animations.

`snapshot()` and `GameEnvironment.fromSnapshot(snapshot)` support exact replay and branching.
Snapshots contain every private hand: they are privileged debugging/checkpoint data and must not
be passed to a policy. Returned decisions expose only the acting player's private cards and public
information. `standings()` returns public portfolio data.

## Checks

Node 22.18+ can run the tests without installing anything:

```sh
npm test
```

The tiny `register.mjs` resolves extensionless TypeScript source imports using Node's built-in
TypeScript stripping; it loads no framework or web application. For independent type checking:

```sh
npm ci
npm run check
```

Tests cover complete four- and six-seat games, special cards, seeded resets, checkpoint replay,
stale/invalid-action rollback, hidden information, and dependency isolation. The live game's
`tests/shared-engine.test.ts` provides Convex-versus-memory full-game parity coverage.
