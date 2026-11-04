# NPC implementation plan

> Historical record, not current setup or release instructions. Moved from `stockmarket-convex/NPC_IMPLEMENTATION_PLAN.md`; preserved from the pre-extraction project history. Paths and validation counts in the text describe that work. Use [setup](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/SETUP.md), [deployment](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/DEPLOYMENT.md) and [release verification](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/RELEASE_VERIFICATION.md) for the current workspace.

Status: proposed implementation, not implemented code. Scope: the React/Convex application in `stockmarket-convex/`; the older Go application in `stockmarket/` is outside this change. Source: `local-notes/NPC_DESIGN.md`, which remains unchanged. Snippets below illustrate proposed interfaces and control flow, rather than drop-in code.

## 1. Product contract

Every newly started game must have **four to six total players**, counting humans and NPCs equally. Waiting lobbies may temporarily contain fewer than four players. Keep the existing six-seat maximum: this supports one human and all five personalities, four humans and two NPCs, and five humans and one NPC. Raising the maximum later requires separate deck-capacity, supply, balance and layout work.

The host chooses one NPC difficulty for the game: Easy, Medium or Hard (default Medium). It applies to all NPCs and is editable only while waiting. This supersedes the source document's suggestion of individually selected difficulties. Personalities are randomly assigned; there is no character picker. Random assignment supersedes references in the source to choosing particular opponents.

| Humans | Minimum NPCs required to start | Additional NPCs allowed | Maximum NPCs |
| --- | ---: | ---: | ---: |
| 1 | 3 | 2 | 5 |
| 2 | 2 | 2 | 4 |
| 3 | 1 | 2 | 3 |
| 4 | 0 | 2 | 2 |
| 5 | 0 | 1 | 1 |
| 6 | 0 | 0 | 0 |

- Require at least one human. NPCs cannot host a game.
- Provide **Add NPC**, **Add required NPCs**, and removal controls to the host. Never silently fill or launch an undersized lobby. All users see the roster and difficulty; only the host edits them, matching existing game settings permissions.
- Show “Add 2 NPCs or invite 2 players to start” for a two-seat lobby. Disable Start until the minimum is met; the server independently enforces the same condition.
- Additional NPCs remain available after the minimum is met, until six seats are occupied. Do not clamp NPC count to the deficit.
- Assign from the five-personality cast without replacement within a game. Persist a shuffled assignment queue when the first NPC is added; consume it as NPCs are added. Existing assignments do not change when difficulty or roster size changes. Removed personalities return to the end of the queue, avoiding a fresh random draw on each remove/add.
- A new human cannot silently displace an NPC in a full lobby. The host can remove an NPC first. Concurrent joins, adds and starts recheck capacity transactionally.
- Freeze the roster and difficulty at start. A human disconnect retains their existing seat, as today; automatic replacement during play is outside scope.
- In a waiting lobby, transfer a departing host's role to another human. If the last human leaves, delete the waiting game and its NPC configuration/state; do not leave an NPC-only lobby.

## 2. Existing implementation and required changes

`shared/rules.ts` currently sets the minimum to two. `convex/games.ts` enforces six seats but starts with two. `src/GamePage.tsx` contains the waiting room and two-player copy. Centralise both minimum and maximum in shared rules and use them in every lobby mutation and UI control.

Currently `players.userId` is mandatory, `games.currentUserId` identifies the active turn, `board.get` loads an account for every seat, and trading uses that account's name and portrait. Replace these assumptions with player-seat identity. Do not create fake authenticated users for NPCs.

The existing trading mutation contains useful authoritative validation: price above zero, quantity steps, cash, ownership, supply and expected turn. Extract it into a controller-neutral game command service before adding strategies. `rounds.next` already rotates the starting seat by period; preserve that rule and its zero-based period conventions (`periodCount` is the final period index).

The feed currently has display text and optional trade quantities, but no actor identity or turn key. Add structured events: Casey and Felix must never infer authors or actions by parsing prose or reading only the last 100 feed entries.

## 3. Isolation and dependency direction

“Separate NPC code” means all personality rules, estimates, memory, randomness and planning live in an independent TypeScript package. The game owns state, legality, settlement and turn advancement. A small server integration layer connects them. Some game changes are necessarily required to represent and schedule NPC seats; no NPC strategy belongs in game rules, React components or trading mutations.

```text
React UI ──> public authenticated endpoints ──> game command service
                                                     ^
Convex NPC worker ──> restricted observation ──> NPC engine
        └──────── validated proposed command ────────┘

NPC engine ──> controller-neutral contracts only
Game rules ──> controller-neutral contracts/shared rules only
```

The engine cannot import `convex`, React, auth, database models, application services or frontend code. The game core cannot import personality implementations. Integration modules are the only code allowed to depend on both. Enforce this with ESLint restricted imports plus an architecture test that checks transitive dependencies; include the new directories in TypeScript and lint coverage. A separate runtime service is unnecessary for this bounded rules-based engine.

```text
stockmarket-convex/
├── NPC_IMPLEMENTATION_PLAN.md
├── local-notes/NPC_DESIGN.md             # reference only; do not edit
├── packages/
│   ├── game-contracts/src/index.ts       # plain readonly DTOs and commands
│   └── npc-engine/
│       ├── package.json                 # private package; explicit exports
│       ├── tsconfig.json                # no browser or Convex dependencies
│       └── src/
│           ├── index.ts                 # decide(observation, state, seed)
│           ├── roster.ts                # five static identities/metadata
│           ├── difficulty.ts            # typed, versioned tuning parameters
│           ├── random.ts                # injected deterministic PRNG
│           ├── estimate.ts              # cards, sampling, floor, uncertainty
│           ├── targets.ts
│           ├── candidates.ts            # consume server-provided legal options
│           ├── planning.ts              # bounded one-to-three-action search
│           ├── memory.ts                # credibility and observed following
│           └── personalities/
│               ├── frankie.ts
│               ├── casey.ts
│               ├── ada.ts
│               ├── felix.ts
│               └── morgan.ts
├── convex/
│   ├── schema.ts                        # player seats, events, NPC state
│   ├── games.ts                         # human lobby API; start orchestration
│   ├── trading.ts                       # human command adapter
│   ├── rounds.ts                        # round orchestration
│   ├── board.ts                         # explicit client-safe projection
│   ├── game/
│   │   ├── commands.ts                  # authoritative applyTurn
│   │   ├── seats.ts                     # ordered seats and public identity
│   │   ├── legalActions.ts              # same rules as applyTurn
│   │   └── events.ts                    # typed public action events
│   └── npc/
│       ├── lobby.ts                     # host-only NPC configuration
│       ├── observation.ts               # information boundary
│       ├── scheduling.ts                # pending work and recovery
│       ├── worker.ts                    # internal scheduled mutation
│       └── persistence.ts               # memory and private decision traces
├── src/npc/
│   ├── NpcLobbyControls.tsx
│   ├── NpcIdentity.tsx
│   └── NpcTurnStatus.tsx
├── shared/rules.ts                      # minimum=4, maximum=6
├── tests/npc/                           # engine, integration, privacy, timing
└── scripts/simulate-npcs.ts              # seeded offline evaluation
```

Use small pure functions, exhaustive discriminated unions, readonly inputs and explicit units. Avoid a large inheritance hierarchy or one switch statement containing all fifteen strategies. Share estimation/planning primitives; keep each personality's preferences explicit. Store version numbers for strategy parameters and memory so saved games remain interpretable across deployments.

## 4. Player model, events and migration

Use an explicit controller discriminator, stable seat order and seat-based turn identity. The database schema should validate the human/NPC variants, not merely permit unrelated optional fields.

```ts
// Conceptual persisted variants; Convex IDs are confined to the adapter.
type Controller =
  | { kind: "human"; userId: UserId }
  | { kind: "npc"; personality: PersonalityId };

type PlayerSeat = {
  id: PlayerId;
  gameId: GameId;
  seatOrder: number;
  controller: Controller;
  cash: number;
  holdings: readonly Holding[];
};
// games: hostId remains a human user ID.
// games: currentPlayerId replaces currentUserId after migration.
// games: npcDifficulty, rosterRevision, rulesVersion.
// Private npcGameConfig: assignment queue/seed and engine version.
```

Keep NPC memory and decision traces in separate private tables keyed by game and player. Never spread those documents into `board.get`. If a turn seed, pending schedule or assignment queue is persisted, expose only specifically approved status fields to clients. Names, portraits, tagline, difficulty and controller kind are public.

Add `gameActions` with `(gameId, period, turn, actorPlayerId, action)` and an index for game/period/turn. An action is a typed buy, sale or pass; feed copy is rendered separately. Record a period-close summary with opening/settled prices for reputation updates. Retain complete structured history needed by the strategies, rather than relying on the UI feed's 100-item window.

Add source catalog-card identity to newly dealt insights and freeze the catalog version used by each game. This makes removing the NPC's own cards from the public pool unambiguous, including duplicate-valued cards. A snapshot of the catalog distribution is public information; actual deck order, deal seed and opposing hands are not.

Migration sequence:

1. Add compatible optional fields and read adapters. Backfill existing players as human seats, assigning stable seat order consistent with existing rotation. Resolve each existing current user to their player seat.
2. Update membership, board identity resolution, host transfer, trading, round rotation and frontend turn comparisons. `Playing.tsx`, `StockPanel.tsx` and `Feed.tsx` compare the current player ID with the viewer's seat ID. `Portfolio.tsx` uses seat identity for ownership.
3. Keep existing live games operational under their saved rules version; enforce the four-seat minimum for every new start, including old waiting lobbies. Do not inject NPCs into an underway two-player game.
4. Validate the backfill, remove compatibility reads/writes and then require the new schema. Do not remove `currentUserId` before all consumers are migrated.

Existing short-handed tests are not a reason to weaken production validation. Update fixtures that start games to four humans or a deliberately configured mixed roster, and retain explicit two-player start-rejection tests.

## 5. Contracts and fair observation

The observation builder is trusted game infrastructure; the decision engine is treated as an untrusted proposer. Query the NPC's own current hand using a player/period index. Do not fetch every private hand and pass a filtered database object to the engine.

```ts
export type Action =
  | { kind: "pass" }
  | { kind: "buy" | "sell"; stockKey: number; quantity: number };

export interface NpcObservation {
  readonly selfId: string;
  readonly period: number;
  readonly finalPeriod: number;
  readonly turn: number;
  readonly actionsRemaining: 1 | 2 | 3;
  readonly players: readonly PublicSeat[];
  readonly prices: readonly StockPrice[];
  readonly ownInsights: readonly OwnInsight[];
  readonly catalog: readonly PublicCatalogCard[];
  readonly events: readonly PublicActionEvent[];
  readonly settledPeriods: readonly PublicPeriodSummary[];
  readonly legalActions: readonly Action[];
  readonly remainingSeatOrder: readonly string[];
}

export interface Decision {
  readonly action: Action;
  readonly nextMemory: NpcMemory;
  readonly reason: ReasonCode; // private until the round reveal
}

export function decide(
  observation: NpcObservation,
  profile: NpcProfile,
  memory: NpcMemory,
  seed: string,
): Decision;
```

The named DTO types are plain serialisable types to define in the contracts package. The engine receives public cash, holdings, rankings, supply, completed public trades and previously revealed results, plus its own hand. It receives neither future deals nor private current insights belonging to anyone else. Harder difficulty changes judgment, never access.

Generate legal actions from the game rules. Use the existing share-size functions, £60,000 starting cash, ten insights per period, three actions per seat and 200,000 shared supply. The engine ranks feasible options; the command service revalidates the chosen option against current state. Negative return estimates cannot create short sales. Zero-price stocks are untradable, including Frankie's favourite. Use existing money rounding consistently; do not add a second arithmetic convention inside the engine.

Multi-action simulation uses the same pure transition/legality helpers through a controller-neutral interface, recalculating cash and supply after each hypothetical action. Do not independently reimplement trade validation in Morgan's planner. No branch may bypass the final authoritative command check.

## 6. Decision pipeline and personality implementation

For each turn: build a fresh observation, update memory from newly observed events, estimate returns, construct targets, rank legal candidates and choose one action. Persist memory only with the accepted action. A planned future action is advisory and must be reconsidered after intervening turns.

Implement all fifteen profiles from the source, preserving deliberate weaknesses:

| Personality | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Frankie | 85% favourite; never voluntarily sell it | 60% favourite, reduced to 30% on negative signal; up to 25% alternative | 40% favourite, 15% even when negative; up to 50% across alternatives; uncertainty-aware |
| Casey | Copy latest opponent trade up to 2,000; random affordable purchase if none | Follow period-start leader's net trades; own-card veto; 40% cap and 20% cash | Three-period directional credibility; roughly 60/40 card/behaviour blend; 45% cap and 10% cash |
| Ada | Strongest individual negative sale first, otherwise positive purchase up to 2,000 | Sum own cards; sell negative exposures; top two at 40% each | Remaining-pool estimates and sampling; up to 90% invested, 50% cap |
| Felix | First-action 1,000-share negative bait, unwind, then genuine trade | At most one bait, 5% wealth budget; skip final period/tight cash/urgent sales; 45% genuine cap | Two observed following responses required; 3% bait budget; no final-period bluff; 50% genuine cap |
| Morgan | Top two at 25% each; at least 50% cash | Roughly 80/20 cards/credible behaviour; up to 80% invested; 45% cap; account for actions needed | Sample bounded multi-action plans; normally 65% cap, up to 90% with strong final-period evidence |

These are target budgets, not forced transactions. Unallocated wealth stays in cash. Supply and action limits can prevent reaching targets. When existing price moves put a holding above a cap, prioritise sensible reductions rather than pretending a target cap invalidates the current portfolio. Honour explicit personality exceptions such as Easy Frankie's refusal to sell.

For Hard Ada's shared estimator, let `R` be the public catalog minus the NPC's own ten cards and `U = 10 * (playerCount - 1)`:

```ts
const expectedChange = ownSignal
  + unseenDealtCount * remainingStockValueSum / remainingPoolSize;
```

Check pool capacity before dealing. Sample `U` cards without replacement from the complete remaining multiset, including cards for other stocks. Apply the actual settlement function and zero floor to each sample. Prior rounds inform behavioural credibility but do not remove cards from a freshly reshuffled period. Compare expected percentage returns only for positive current prices. Price outcomes are uncertain even on Hard.

Credibility uses bounded directional scores per stock and completed period, averaged over up to three periods, with neutral newcomers and shrinkage for small sample sizes. Convert bounded behaviour scores into expected price-change units using a documented public volatility scale before blending; raw share quantities cannot be mixed directly with pounds. Ada never consumes behaviour signals.

Felix records the bait stock, quantity, turn and intervening observed responses. Require two separate qualifying responses before treating an opponent as susceptible; a response is evidence, not proof. Check that a susceptible player still acts before Felix's next turn. Reserve enough actions to unwind and invest; skip bluffing when a genuine sale is urgent. The market price cannot be pumped by trading.

Morgan evaluates a bounded candidate set over the remaining one, two or three actions. Use sampled wealth at the upcoming settlement as the immediate objective, with remaining-period risk/optionality adjustments; do not imply a solved simulation of every future game. On the final period this is terminal wealth. Include pass, sales, buys, switching and split allocations. Benchmark an initial cap such as 64 candidate plans and 128 common outcome samples; adjust from measured server execution limits. Share samples across candidates for fair comparisons. Rank ties deterministically with seeded variation.

## 7. One authoritative turn path and reliable scheduling

Extract `applyTurn` from `trading.play`. It accepts an already-authorised player seat, expected period/turn and a typed action; validates the seat is current; applies cash/holdings; records one event and feed item; advances exactly one turn; and closes the round after `players.length * 3` actions. Authentication remains at entry points. A public caller cannot submit an arbitrary NPC seat ID.

The human endpoint resolves its authenticated seat, then calls this service. The internal NPC worker resolves its scheduled seat, verifies it is NPC-controlled, asks the engine for a proposal and calls the same service. Use integration orchestration to enqueue the next NPC after a successful command, start, or next-period deal. The game core itself does not import NPC strategy or scheduling modules.

```ts
// Conceptual internal mutation body; helper implementations are planned above.
const game = await loadGame(ctx, job.gameId);
if (!matchesPendingTurn(game, job)) return; // stale/duplicate/deleted/closed
const seat = await loadNpcSeat(ctx, job.playerId);
const observation = await buildNpcObservation(ctx, game, seat);
const decision = decide(observation, seat.profile, seat.memory, job.seed);
const action = validateProposal(decision.action, observation.legalActions)
  ? decision.action
  : { kind: "pass" } as const;
await applyTurn(ctx, {
  playerId: seat.id, expectedPeriod: job.period,
  expectedTurn: job.turn, action,
});
await saveAcceptedDecision(ctx, job, decision, action);
await enqueueNextNpcIfNeeded(ctx, job.gameId);
```

Use Convex internal scheduled mutations for bounded computation, not browser timers. Persist the pending token `(gameId, period, turn, playerId, generation)` and stable decision seed; period is required because turn resets each round. Scheduling and state changes should commit atomically. A duplicate or superseded job returns without acting. Store memory, command, trace and next schedule in the same successful transaction.

Separate randomness streams for roster assignment, decisions, outcome samples and presentation delay. Never give the engine the actual dealing seed. Retries for the same pending token reproduce the same proposal; parameter versions are pinned for an active game.

Malformed proposals use a legal pass and a private diagnostic record. Unexpected database/transaction failures must not be swallowed as passes: let the transaction fail. Add a bounded periodic recovery sweep for overdue pending turns, checking the same token before rescheduling. After repeated decision failures for one token, commit a recorded fallback pass through the normal command service. Recovery must work without a connected browser and must not run when a human owns the turn or while reveal is open. Monitor stuck-turn age, execution time, retries, invalid proposals and fallback rate.

At round close, stop scheduling. Keep the current human-host-driven reveal/advance flow; NPCs require no Ready click. Update credibility exactly once per settled period before the next NPC decision. Do not auto-advance while people are reading the reveal. Special-card NPC decisions are out of scope: validate that the NPC-enabled catalog is ordinary-only at start so an unsupported hold card cannot strand a round.

## 8. Making play feel natural

NPCs should feel like recognisable players sharing the table, with understandable strengths and mistakes. They take the same turns, hold the same private information, use the same feed and score under the same rules.

Define the following fixed name-to-portrait mapping in `packages/npc-engine/src/roster.ts`. Asset files live under `public/static/imgs/` and are served at the URLs below. Random assignment selects the complete NPC identity; never randomise the portrait independently of the name. This mapping stays the same at every difficulty and wherever the NPC appears.

| NPC name | Portrait URL |
| --- | --- |
| Frankie Faithful | `/static/imgs/1profile.png` |
| Casey Copycat | `/static/imgs/2profile.png` |
| Ada Ledger | `/static/imgs/3profile.png` |
| Felix Fox | `/static/imgs/4profile.png` |
| Morgan Sharp | `/static/imgs/5profile.png` |

- Show assigned name, portrait, tagline, NPC label and game difficulty in the lobby and portfolio. Verify the five PNG portrait assets are available in deployed builds: the repository ignores PNG files, so source paths alone are not sufficient verification.
- Use a small server-scheduled, bounded pause, initially around 0.8–1.8 seconds per NPC turn. Add slight seeded variation independent of hidden cards or planned action, preventing timing from signalling private information. Tune the total wait across five consecutive NPCs, not just one turn.
- Show “Ada is considering a move…” and a stable current-player highlight. Do not expose confidence, target stock or bluff state. Announce completed actions accessibly without trapping keyboard focus. Respect reduced-motion preferences.
- Append exactly one normal action entry per turn, including passes. A reconnect shows committed state without replaying a backlog of animations. Human controls remain disabled only when it is genuinely another player's turn.
- Recompute from the latest public state when each NPC acts. Casey reacts to recent purchases; Felix adapts to observed following; Morgan notices diminishing supply. Do not queue an entire period's moves in advance.
- Preserve personality through decisions: loyal Frankie, reactive Casey, arithmetic Ada, occasional bluffer Felix and efficient Morgan. Do not introduce random illegal moves or universally optimal play that erases those identities.
- Passing and retaining cash are valid, visible choices. Do not liquidate at game end: final cash plus settled holdings determines wealth.
- Optional flavour text is short, infrequent and separate from the factual event. Use curated strings initially; no LLM is needed. Do not invent trades, observations or claimed access to opposing hands.
- Optional explanations become available only after the relevant hand is public. Build them from stored reason codes and committed actions, not a retrospective invented rationale. Never reveal future sampled plans, hidden engine state or live private cards in a public status field.

The lobby should communicate that difficulty improves each personality's judgment. Hard Frankie can still be easier than Hard Morgan. Randomly receiving Frankie should feel like meeting a different opponent, not receiving a broken difficulty setting.

## 9. Verification and balance

Use the existing Vitest and convex-test setup. Tests must exercise meaningful invariants and failure modes, not simply duplicate strategy implementation.

1. **Lobby contract:** cover every row of the player table; fewer than four fails on the server; five humans can add one NPC; four humans can add two; seventh seat fails; non-host edits fail; start/add/join races preserve capacity; assignments are unique and stable; difficulty applies to all NPCs; last-human departure cleans up.
2. **Shared rules:** run identical commands through human and NPC adapters and compare portfolio, supply, event and turn outcomes. Include zero prices, insufficient funds, no shares, exhausted supply, NaN/invalid quantities, legal rounding gaps, pass, duplicate commands and close on exactly the last action.
3. **Information boundary:** alter opponents' current private cards while holding all permitted observations constant; NPC input and seeded decision must remain identical. Verify no private memory, seeds, queue or open-period explanations appear in board responses. Ensure catalog versions and duplicate card identities produce correct remaining pools.
4. **Strategy fixtures:** fifteen profile fixtures plus focused cases for Frankie's loyalty, Casey's sale without holdings, Ada's contradictory cards, negative floor sampling, Felix's action budget and final-period restriction, Morgan's feasible sell-then-buy and valuable pass.
5. **Scheduler:** NPC first seat, consecutive NPCs, rotated period starts, duplicate delivery, stale previous-period turn, deleted game, worker failure, recovery race, no connected client, and host-controlled reveal. Each committed turn has exactly one event and one portfolio change.
6. **Whole-game regression:** one human plus three/five NPCs, four humans plus two, five humans plus one, and six humans; finish all supported lengths and compare settlement/rankings. Preserve old live-game compatibility during migration. Test public identity rendering without a user account.
7. **UI acceptance:** keyboard and mobile lobby controls, clear deficit/full messages, stable roster after difficulty changes, natural consecutive-turn pacing, reconnect, reduced motion, no hidden explanation leak and correct Your turn indicator.

Offline simulations use the same engine and pure game rules. Run thousands of reproducible games across shuffled seats, lengths and opponent mixes; include scripted cautious, momentum-following and random-legal human proxies. Record win rate, final wealth, cash utilisation, concentration, pass rate, pointless reversals, bluff response, latency and fallback frequency. Report seed sets and uncertainty intervals. Use paired seeds to compare difficulty within a personality and reserve held-out seeds for final balance checks.

Target Easy < Medium < Hard on average within each personality, Hard Morgan strongest overall, Hard Frankie visibly fallible, and Felix useful against followers but weaker against Ada. These are measured tuning goals, not guarantees for every matchup. Do not “fix” a weak result by leaking information or granting extra cash/actions. Human playtests must confirm readability and pacing; simulations alone cannot establish that play feels natural.

## 10. Delivery order and completion criteria

1. **Seat and command foundation:** introduce contracts, migrate identity and extract authoritative commands/events; preserve existing human gameplay. Exit when human-only regressions and migration checks pass.
2. **Lobby rules and random roster:** implement four-seat minimum, six-seat maximum, host controls, game-wide difficulty, stable assignments and host lifecycle. Exit when capacity/concurrency/permission tests pass.
3. **Observation and scheduler:** wire a temporary pass-only engine in development, test isolation, exactly-once application and recovery. Do not expose incomplete NPCs as a finished feature.
4. **All profiles:** implement baseline estimates, fifteen profile rules, bounded Hard sampling/planning and versioned memory. Exit when strategy, fairness and legality tests pass.
5. **Player experience:** add portraits, labels, pacing, accessible statuses and optional post-reveal explanations. Complete mixed-game browser walkthroughs and reconnect tests.
6. **Balance and rollout:** run simulations, tune against held-out seeds, playtest, then enable for new games. Pin engine versions for active games and retain compatible workers until they finish. An emergency disable blocks new NPC games while existing NPC turns retain a safe completion path.

Before implementation is considered complete, run the repository's `npm run check` with the new package/type coverage and complete the mixed-game acceptance scenarios. Release criteria are: every new game starts with 4–6 seats; random NPCs can be added beyond the minimum; no strategy imports game internals; no private-information leaks; no duplicated or stranded NPC turns; all fifteen profiles are implemented; and playtests find the personalities readable without tedious waits.

This document changes no runtime behaviour and does not modify the source NPC design.
