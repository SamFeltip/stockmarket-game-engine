# AI training findings and plan to surpass Morgan Hard

Date: 6 November 2026. Scope: the overnight 5–6 November training cycle and its fresh all-player competition. This is a proposed research plan; no further training or deployment has been started.

## Assessment

The latest models are close to Morgan Hard, but we have not demonstrated that they are stronger. The clearest improvement came from **Morgan distillation followed by PPO fine-tuning**. More imitation alone produced little additional improvement. The next objective should be a reproducible, substantial advantage over Morgan on fresh games, rather than higher imitation accuracy or a first-place bar on a noisy leaderboard.

The latest artifacts are in `.worktrees/controlled-ablations/`; the main checkout's `stockmarket-ai` README describes only the headless environment. Implementation work should use the compatible training checkout and preserve its model/schema versions.

## Findings from the last session

Training stopped by 07:30 GMT on 6 November. All 24 planned candidate/reference strength evaluations, 11 mixed-field evaluations and three representative fidelity evaluations completed. The cycle retained 23 independent training trajectories. No model was deployed.

### 1. PPO after distillation is the strongest supported direction

| Model family | Medium field score | Hard field score | Primary score |
|---|---:|---:|---:|
| Fresh replay distillation, three seeds | 69.62% | 54.74% | 62.18% |
| Richer own-hand inputs, three seeds | 70.19% | 54.79% | 62.49% |
| Continued distillation, three seeds | 70.87% | 55.38% | 63.13% |
| PPO fine-tuning, three seeds | 74.81% | 58.94% | 66.88% |
| PPO plus imitation, three seeds | 73.98% | 59.94% | 66.96% |
| Original Morgan Hard | 76.19% | 60.53% | 68.36% |

These are pairwise finishing-position scores against NPC fields: finishing ahead of an opponent scores 1, tying scores 0.5, and finishing behind scores 0. Primary is the equal-weight Medium/Hard mean. **They are not game-win rates or direct Morgan win rates.** Each candidate received 512 Medium, 512 Hard and 128 Easy deals.

Ordinary PPO fine-tuning improved primary score over replay by **4.69 percentage points**, with a paired evaluation-only 95% interval of **+2.96 to +6.46**. The direction was positive in all three seeds. Regularized PPO improved by **4.78 points**, interval **+3.44 to +6.13**.

The regularizer's advantage over ordinary PPO was only **0.08 points**, interval **−1.55 to +1.74**. Keep both approaches available, but the evidence does not justify declaring regularization the winner. It helped early retention; its tighter scores across three seeds do not establish generally lower variance.

### 2. The models approached Morgan; they did not establish superiority

The fresh competition contained 60 entrants, 3,840 six-player games and 384 appearances per entrant, with balanced seats.

| Entrant | Overall field score | Approximate 95% interval |
|---|---:|---:|
| Morgan Hard | 68.74 | 65.81–71.66 |
| PPO plus imitation, seed19073 | 68.39 | 65.34–71.45 |
| PPO fine-tuning, seed39089 | 68.17 | 65.14–71.19 |

The strongest new entries were within 0.57 points of Morgan, with substantial uncertainty. This leaderboard does not demonstrate equivalence or superiority. Each pair shared only 32–34 games, so individual matchup cells are especially noisy. Use a dedicated paired comparison to establish an advantage; overlapping individual intervals alone are not a formal difference test.

The family means in the NPC benchmark still trail Morgan by about 1.4–1.5 points. The all-player competition measures a different opponent distribution and cannot be combined directly with those scores.

### 3. More teacher exposure and more inputs are not sufficient by themselves

- Fresh replay reproduced a large gain over the older non-replay 512 model: **+13.56 points**. Replay is a useful foundation.
- Continued distillation added **0.94 points**, interval **−0.20 to +2.15**. A useful further gain was not established.
- Adding 48 own-hand summaries added **0.31 points**, interval **−0.88 to +1.57**. This specific input experiment does not justify adoption; it does not prove all additional information is useless.
- The PPO control scored **51.37%** primary, far below the distilled-and-fine-tuned families in this cycle. Preserve the successful initialization instead of restarting the main effort from scratch.
- Exact teacher-action agreement fell from **47.35%** for the replay representative to **41.86%** for the stronger regularized representative. Playing strength should determine selection; teacher agreement remains a diagnostic.

### 4. The evidence has limits

There were only three training seeds per main family. Reported paired intervals describe evaluation uncertainty conditional on those trained models, not all future training runs. Distillation and PPO had different exposure and elapsed-time budgets; regularization started later following validation regressions. This establishes useful strength gains, not a clean compute-efficiency ranking. The width study also lacked isolated per-width elapsed timings.

## Proposed definition of “much better”

Freeze these targets before the next experiment. They are proposed acceptance criteria, not achieved results.

1. **Direct advantage:** at least **60% pairwise finishing score against Morgan Hard**, with the deal-clustered 95% lower bound above **55%**, in a fixed four-to-six-player matchup protocol. This measures finishing above Morgan within multiplayer games, not winning the whole game.
2. **Broad advantage:** at least **+5 percentage points over Morgan** on the same frozen Medium/Hard field benchmark, with the paired 95% lower bound above **+2 points**.
3. **Repeatability:** positive direction against Morgan across at least five independent training seeds; show the complete seed distribution and separately evaluate the validation-selected deployable checkpoint.
4. **Robustness:** simultaneous or multiplicity-adjusted subgroup intervals rule out losses worse than two points in predeclared difficulty and player-count groups. Report seat and game-length breakdowns as diagnostics.
5. **Operational quality:** zero observed illegal-action fallbacks or hidden-information violations in the validation suite, plus measured p95 inference time and memory within a deployment budget fixed before model selection.

Failure to reach these targets means “improved” or “inconclusive,” not “much better.”

## Ordered implementation plan

**Update after the completed two-hour screen:** see [findings and the revised long-run protocol](TWO_HOUR_FINDINGS_AND_LONG_RUN_2026-11-06.md). All budgets completed with no recorded failures. Fixed imitation averaged 64.23%, ordinary PPO 62.78%, and fast decay 60.37%. No clear winner was established between fixed and ordinary PPO. The next long run should compare those two treatments across three paired distilled starts; omit the tested fast-decay schedule from the main allocation. This regularization comparison comes before changing opponents. The larger confirmation and diagnostic phases below remain the broader programme.

### Phase 1 — Confirm the current starting point

Freeze hashes for Morgan, the replay references and the two already preselected representatives: ordinary PPO `finetune-seed39089` and regularized PPO `regularized-seed19073`. Preserve checkpoints and optimizer state.

Build a dedicated fresh comparison in which the candidate and Morgan share games, with a fixed mixture of remaining opponents. Rotate both through seat assignments and cluster all rotations by underlying deal. Also compare each against identical external NPC fields on common deals. Keep these two estimands separate.

Budget initially for **2,048 independent deals per main protocol**, with the exact count fixed using variance estimates from existing results before new test outcomes are opened. Increase the planned count beforehand if needed to resolve the target margin. Reserve distinct training, diagnostic, validation and final-test ranges; never select checkpoints on the final set.

**Deliverable:** a reproducible benchmark with paired differences, direct Morgan scores, game-win rates, wealth distributions and confidence intervals. This determines how large the remaining gap actually is.

### Phase 2 — Identify where the remaining losses occur

On a separate diagnostic set, retain action traces and public/own-hand observations. Break down losses by period, remaining actions, cash deployment, portfolio concentration, debt, stock supply, special-card decisions and opponent composition.

Audit whether the neural action vocabulary can express valuable legal quantities, card choices and multi-action sequences. Count unavailable actions separately from poor policy choices. Compare selected actions with alternative legal actions using repeated sampled continuations; teacher disagreement alone is not an error label.

Use only information available to the acting player when constructing hypothetical hidden states. Actual private snapshots may support engine debugging, but must not become policy inputs or privileged search information.

**Deliverable:** a ranked set of recurring decision failures, with frequencies, estimated outcome cost and uncertainty. Expand action coverage only if this audit demonstrates a restriction.

### Phase 3 — Test stronger training opponents

Start from paired copies of successful distilled checkpoints. Compare the existing PPO opponent schedule against a versioned league containing Morgan Hard, other Hard personalities, frozen strong learned policies and past self-play snapshots. Keep a fixed diverse component so learning cannot concentrate entirely on one opponent.

Use equal environment-decision budgets and the same evaluation schedule for the comparison. Record wall time, unique games, decisions and optimizer updates separately. First run three paired seeds as a screen; confirm a selected improvement across at least five independent end-to-end seeds.

Use imitation to establish competent starting play, then test how much teacher constraint is useful during outcome-driven learning. Pure imitation rewards matching Morgan, including its mistakes; it provides no reliable objective for discovering substantially stronger play. It is not a hard performance ceiling once PPO can optimize game outcomes. An ongoing imitation penalty may prevent deterioration, but may also discourage useful departures. The current results do not establish that this penalty is limiting performance.

The three-treatment screen is now complete. Follow the [revised long-run protocol](TWO_HOUR_FINDINGS_AND_LONG_RUN_2026-11-06.md): compare zero and fixed 0.1 imitation from identical paired distilled checkpoints, targeting 2,800,640 new decisions per run across three starting seeds. Hold opponents and all other training settings fixed. Use predeclared validation looks, then untouched final evaluations. The tested decay-to-zero-by-131,072 schedule did not meet its retention gate and is deferred. A slower or delayed schedule would be a new hypothesis, not a validated replacement.

**Hypothesis:** stronger and more varied opponents will expose exploitable strategies that further teacher imitation cannot address. This has not yet been demonstrated by the overnight cycle.

### Phase 4 — Test planning and memory only where diagnostics support them

The current learner must choose actions in a partially observed, multi-action game. Two controlled experiments offer plausible routes beyond its present performance:

- **Limited lookahead:** rank a small set of legal action sequences using the shared engine, sampled hidden states consistent with available information and a learned continuation value. Include passing and sell-then-buy sequences. Compare policy-only and policy-plus-search at a fixed decision-time budget. If useful, distill improved search choices into a fast policy.
- **Public-history memory:** test compact opponent-behaviour summaries first, then a recurrent policy if necessary. Include only observable actions and revealed outcomes. Compare with the unchanged feed-forward model at matched budgets. Morgan already uses credibility-weighted behaviour estimates; the overnight own-hand experiment did not test this capability.

If the action audit finds material omissions, run action-vocabulary expansion as its own experiment before attributing gains to search or memory. Version the observation/action schema and verify training/export/live inference parity.

**Deliverable:** measured gains and latency costs for each isolated change. These are research hypotheses, not prerequisites proven necessary by the existing results.

### Phase 5 — Confirm, export and verify the winner

Choose the architecture, training recipe and checkpoint-selection rule using validation. Freeze them before running a new final benchmark. Evaluate the successful recipe across at least five independent seeds and evaluate the chosen checkpoint on the untouched direct-Morgan and broad-field protocols.

Report practical margins, paired uncertainty, training-seed spread and relevant subgroup results. Preserve failed treatments. Check full-game simulator parity, hidden-information boundaries, legal-action masks, restart recovery and exported-policy inference agreement. Measure latency on the actual target runtime before deployment.

Promote only if the predeclared strength and operational gates pass. Otherwise retain the incumbent and use diagnostic evidence to select the next experiment.

## Resource priorities and stopping rules

Use the existing 512×512 model as the starting architecture. Do not buy a larger model or schedule an open-ended run on the assumption that scale alone fixes the gap. The previous ordinary PPO runs consumed roughly 2.75–2.78 million decisions per seed over 8.88 hours; use this as a local planning reference, not a throughput guarantee for new treatments.

The two-hour screen is complete. The immediate next long cycle compares ordinary PPO with fixed imitation using the revised protocol linked above. Recalibrate throughput and reserve evaluation time before freezing its duration; current observations suggest roughly 12–14 hours of training at the proposed exposure, plus validation and final evaluation. Preserve matched decision budgets and controls. Stronger opponents and architecture changes follow as separate experiments.

The strongest supported recipe today is **replay distillation → PPO improvement → independent evaluation**. A large advantage over Morgan will require demonstrating additional gains from better training situations, better decisions or both. More time copying Morgan has not shown that advantage.

## Local evidence

- [Overnight executive summary](../.worktrees/controlled-ablations/stockmarket-training/models/training-cycle-2026-11-05/EXECUTIVE_SUMMARY.md)
- [Full report, budgets and uncertainty](../.worktrees/controlled-ablations/stockmarket-training/models/training-cycle-2026-11-05/FINAL_REPORT.md)
- [Machine-readable results](../.worktrees/controlled-ablations/stockmarket-training/models/training-cycle-2026-11-05/comprehensive-results.json)
- [Effective experiment contract](../.worktrees/controlled-ablations/stockmarket-training/models/training-cycle-2026-11-05/effective-experiment-manifest.json)
- [Training implementation and protocol](../.worktrees/controlled-ablations/stockmarket-training/research/training_cycle/README.md)
- [Fresh competition protocol](../.worktrees/controlled-ablations/stockmarket-training/reports/all-player-competition-2026-11-06/README.md)
- [Fresh competition leaderboard](../.worktrees/controlled-ablations/stockmarket-training/reports/all-player-competition-2026-11-06/leaderboard.csv)
- [Morgan behaviour estimates](../.worktrees/controlled-ablations/stockmarket-shared/src/packages/npc-engine/src/personalities/morgan.ts)

These links point to retained local worktree artifacts; they will require relocation if that worktree is removed or the document is published elsewhere.
