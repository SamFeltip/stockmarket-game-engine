# Historical NPC implementation notes

> Historical record, not current setup or release instructions. Moved from `stockmarket-convex/NPC_IMPLEMENTATION_NOTES.md`; preserved from the pre-extraction project history. Paths and validation counts in the text describe that work. Use [setup](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/SETUP.md), [deployment](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/DEPLOYMENT.md) and [release verification](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/RELEASE_VERIFICATION.md) for the current workspace.

NPC implementation and verification — 18 October 2026

The React/Convex application now supports four to six seats, per-NPC difficulty controls, host-only additions/removals, a stable random cast, seat-based turns, and all fifteen profiles. The older Go application and `local-notes/NPC_DESIGN.md` are unchanged.

The engine lives in `packages/npc-engine`; its only transitive dependencies are plain contracts and pure shared rules. The contracts own trade legality, quantity sizes, rounding and hypothetical transitions. The game command service owns authoritative settlement, public events, feed entries and turn advancement. ESLint, an import-graph test and a separate TypeScript configuration enforce this boundary.

NPC observations query only that seat’s hand, plus public portfolios, complete structured action history, completed settlements and the game’s catalog snapshot. Cards retain their catalog identity, so equal-valued cards remain distinguishable. Memory, roster/decision seeds, pending tokens and decision traces live in private tables and are excluded from the board projection.

Scheduling uses internal mutations, atomic turn application, a stable seed/token, 0.8–1.8-second presentation delays and a minute recovery sweep limited to 32 overdue turns. Engine exceptions receive bounded retries before a recorded pass; malformed actions receive a recorded pass immediately. Database and observation failures roll back. Recovery can eventually pass through the normal command path without requiring a browser. No work runs during reveal, and the human host advances periods.

Verification completed:

- `npm run check`: lint, 113 tests, both application/engine type checks, production build, and deployed portrait-copy validation pass.
- Complete games for every supported length (6–10 periods), across 1 human + 3 NPCs, 1 + 5, 4 + 2, 5 + 1, and 6 humans. Settlements, exactly one event per turn, rankings, no fallback diagnostics and final completion are checked.
- Tests cover all fifteen profiles, command equivalence, private-hand invariance, capacity/permissions, stable assignment queues, stale/duplicate jobs, retries/recovery, legacy two-human live games, special-catalog rejection, cash reserves and public NPC identity rendering.
- Local browser walkthrough used actual authenticated Convex test handlers and the real React components: mobile lobby, guest permissions, keyboard activation, additional NPCs beyond the minimum, all five portraits, consecutive NPC turns, reconnect, portfolio identity, host-controlled reveal and a rotated NPC opening turn. No browser console errors were observed. The temporary preview server and fixtures were removed.
- The portraits retain their existing JPEG/AVIF encodings and `.png` URLs. Their exact bytes are verified in the production build, and the five source paths are explicitly exempted from the repository’s PNG ignore rule.

Offline balance evaluation:

`npm run simulate:npcs` runs 3,000 reproducible games: 200 paired seed cases × five personalities × three difficulties. There are 160 development cases and 40 fresh held-out cases per profile. Games shuffle seats, use 4–6 seats and 6–10 periods, and include cautious, following and random-legal human proxies. The focus profile is varied against fixed Medium NPC peers to isolate its difficulty effect; production lobbies now support a difficulty dropdown on each NPC card. The report contains exact seed sets, Wilson win-rate intervals, wealth intervals, paired differences, cash/concentration/pass/reversal metrics, measured decision latency and bluff responses.

Held-out mean final wealth (40 games per cell):

| Personality | Easy | Medium | Hard |
| --- | ---: | ---: | ---: |
| Frankie | £83,438 | £140,375 | £208,312 |
| Casey | £85,850 | £115,638 | £243,550 |
| Ada | £89,088 | £187,200 | £330,875 |
| Felix | £85,712 | £165,825 | £299,812 |
| Morgan | £131,288 | £204,412 | £478,550 |

All profiles improve mean wealth with difficulty on these held-out cases; Hard Morgan has the highest mean wealth. Zero illegal-action fallbacks occurred. Win-rate confidence intervals overlap, so this does not establish a universal ordering: held-out Hard Ada wins 52.5% and Hard Morgan 50% in their respective benchmark mixes. Hard Morgan’s local p95 decision time is approximately 2 ms. These are local engine timings, not deployed Convex CPU measurements. Reversals include deliberate Felix bait unwinds and are not all mistakes. The full machine-readable results are in `reports/npc-balance.json`.

Rollout and migration:

1. Deploy the compatible schema/functions to the intended Convex environment. This task did not deploy or mutate an existing deployment. During staging, `NPC_DISABLE_NEW_GAMES=true` prevents NPC additions/starts while keeping active NPC turns operational.
2. Run internal `migrations:backfillSeats` with `{"cursor":null}`, then repeat with each returned cursor until `done` is true. It preserves existing seats/rotation and pins legacy games to rules version 1. Every new start, including old waiting lobbies, requires four to six seats and receives rules version 2.
3. Run internal `migrations:validateSeats` page by page, beginning with `{}`; require an empty `invalid` list on every page. The compatibility reads and `currentUserId` mirror are intentionally retained until the actual deployed dataset and older clients are validated. Tightening that schema is a later deployment step, not safe to infer from local fixtures.
4. Verify the recovery cron and internal `npc/recovery:metrics` on the target environment. Use Convex’s own function execution metrics for real CPU/execution duration: the private trace’s `elapsedMs` can be zero inside deterministic mutations. The internal metrics also report pending age, retries, invalid proposals and fallbacks.
5. Complete human table playtests for personality readability and pacing before public rollout. Local browser checks and simulations do not replace that judgment. Remove the emergency disable when rollout is ready; preserve engine/tuning/memory version 1 handlers for existing games when introducing future versions.

The post-reveal explanations and flavour text in the plan were optional and are not exposed. Stored reason codes remain private. No live private cards, confidence, bluff state or future sampled plans appear in the interface.

Lobby revision from the later user sketch: adding opponents requires the Add NPC tile, one seat per click. The separate NPC difficulty section, bulk-fill button, descriptive copy, separate removal list and lobby taglines have been removed. Taglines remain visible on portfolio pages. Hosts choose difficulty independently beneath each NPC portrait and remove NPCs using the portrait’s × button. A Bootstrap tooltip on Launch Game says “minimum 4 players required”, including while launch is disabled. Existing games without a saved per-seat level inherit their former game-wide setting; the old bulk-setting API remains compatible, but is not shown in the lobby.

The revised lobby was checked in the browser: one NPC per tile click, different saved levels on neighbouring NPCs, dropdown dismissal after selection, and the disabled launch button’s Bootstrap tooltip with readable white text. UI tests verify slogans remain in portfolios and are absent from lobbies. `npm run check` passes with 113 tests; the final tooltip styling also passed lint and a fresh production build.
