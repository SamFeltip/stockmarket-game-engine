# Two-hour screen: findings and revised long-run plan

## Completion and validity

The experiment completed at **10:27:41 GMT on 6 November**, approximately 85 minutes after its 09:02:37 start, within the two-hour cap. All six runs reached **262,144 new decisions and 3,072 optimizer steps**. All nine evaluated policies completed 128 Medium and 128 Hard games each: **2,304 policy-games over 256 shared deal seeds**. There were no recorded worker failures. Evaluated checkpoint hashes remain unchanged; raw evaluation rows contain no duplicate policy/tier/deal entries.

Each treatment used the same two distilled starting checkpoints. These are two paired starting seeds, not six independent replications. Evaluation was at the fixed endpoint, without choosing the best intermediate checkpoint. The original manifest, protocol, checkpoints and automatic report remain unchanged.

## Results

Scores below are pairwise finishing-position scores, not whole-game win rates. Primary is the equal-weight Medium/Hard mean; treatment rows average the two starting seeds.

| Treatment | Medium | Hard | Primary | Change from paired starts |
|---|---:|---:|---:|---:|
| Frozen distilled starts | 71.37% | 50.37% | 60.87% | — |
| No imitation | 73.37% | 52.19% | 62.78% | +1.91 pp |
| Decay from 0.1 to zero by decision 131,072 | 70.88% | 49.87% | 60.37% | −0.49 pp |
| Fixed imitation at 0.1 | 71.84% | 56.63% | **64.23%** | **+3.36 pp** |
| Morgan Hard reference | 76.77% | 62.85% | 69.81% | — |

| Paired comparison | Mean difference | Evaluation-only 95% interval | Differences by starting seed |
|---|---:|---:|---|
| No imitation − fixed | −1.46 pp | −4.74 to +1.84 | −4.70, +1.79 pp |
| Decay − fixed | −3.86 pp | −7.37 to −0.40 | −7.21, −0.51 pp |
| Decay − no imitation | −2.40 pp | −5.86 to +1.05 | −2.51, −2.30 pp |

These are exploratory paired comparisons, with no multiple-comparison adjustment. Their intervals describe uncertainty from evaluation deals conditional on these policies, not uncertainty over arbitrary future training seeds. No treatment passed the predeclared clear-lead gate.

## What the screen tells us

**The tested fast decay is a poor candidate for the main long run.** It trailed both alternatives in both starting seeds and finished 3.86 points below the best family mean. The protocol retained decay only if it was within one point of the best; it missed that rule. This is evidence against this particular early linear schedule, not against every possible way of removing imitation. Earlier removal may be premature, but that explanation is a hypothesis: endpoint results do not identify the mechanism.

**Fixed imitation and no imitation both merit longer testing.** Fixed had the best mean, but no imitation won for seed39089. Their mean-difference interval crosses zero. Selecting only the strongest individual checkpoint would obscure that reversal and exaggerate confidence.

**The penalty appears useful against Hard fields in this screen.** Fixed scored 56.63% there, versus 52.19% without imitation and 49.87% with decay. Without imitation did better on Medium on average. Preserve tier-level reporting; a combined score can hide a tradeoff. This is descriptive evidence, not a demonstrated general effect or a direct Morgan matchup.

**Removing imitation is not sufficient to beat Morgan.** All endpoint policies remained below Morgan's reference score on this screening set. Conversely, a fixed imitation penalty did not prevent improvement over the distilled starts. The experiment does not establish an imitation ceiling or prove that retaining the penalty is optimal indefinitely.

**Compute efficiency and strength differ.** No-imitation runs took about 68.3–68.5 minutes each; fixed runs took about 79.0 minutes each under shared-machine contention. That is roughly 16% longer elapsed time for fixed at equal decisions. These are concurrent-run observations, not isolated hardware benchmarks. The decay implementation still queried Morgan after its coefficient reached zero, so this run does not measure the compute savings an optimized decay implementation could achieve.

**The short horizon remains a limitation.** This screen evaluated 0.262 million decisions; the previous selected checkpoint occurred around 1.44 million. We cannot infer eventual convergence, later reversals or a long-run ceiling from this endpoint. Training reward curves cannot replace held-out performance evaluations.

## Revised next long run

1. **Use two treatments: ordinary PPO (`beta=0`) and fixed imitation (`beta=0.1`).** Remove the tested fast-decay treatment from the main allocation. A slower or delayed decay can be a later, separately declared experiment if longer curves show an early benefit from imitation followed by a plateau. Do not introduce it adaptively after opening final results.
2. **Use three paired distilled starts for the next comparison:** existing replay seeds19073, 29083 and 39089. The third expands starting-seed coverage. Assign fresh training RNG seeds and game ranges, pair them between treatments, and identify the two reused starts explicitly. This is a recipe comparison; the eventual five-seed end-to-end confirmation remains a separate adoption requirement.
3. **Target 2,800,640 new decisions per run**, a multiple of the existing 1,024-decision save block, with equal exposure and unchanged model, optimizer settings, reward, action vocabulary and opponents. Start both treatments from each original distilled checkpoint rather than warm-starting them from different short-run endpoints. Preserve the short-run endpoints as references.
4. **Predeclare validation looks at 262,144, 786,432, 1,310,720, 1,835,008, 2,359,296 and 2,800,640 decisions.** Use a fresh fixed validation set of 256 Medium and 256 Hard deals per policy. Include unchanged reference scores and plot both tier and primary performance. Save best-validation and final checkpoints separately. Do not stop solely because of an early dip; stop for numerical/legality failures, resource limits or the fixed deadline.
5. **Recalibrate the duration before launch.** At this screen's throughput, the target extrapolates to roughly 12.2 hours without imitation and 14.1 hours with it, before additional validation time. This is a conservative planning estimate, not a promise: concurrency and released CPU capacity affect throughput. Budget approximately 15–16 hours including validation, then reserve final evaluation/reporting time based on measured throughput. Freeze a wall-clock cap before launch. If constrained to a shorter window, reduce the common decision target in advance rather than giving one treatment more exposure or extending the run after seeing scores.
6. **Keep the short screen out of final confirmation.** Use it to choose treatments only. Freeze checkpoint choices on validation, then compare them on new final deals with paired intervals and separate training-seed summaries. Retain the main plan's direct-Morgan and broad-field protocols and substantial-margin acceptance gates; size those budgets before opening test outcomes. The observed 69.81% Morgan score belongs to this screen and is not a universal benchmark target.
7. **Test stronger opponents afterward, as a separate change.** Keep the opponent schedule fixed for this regularization comparison. Once the recipe is chosen, compare its existing opponent schedule with a stronger diverse league. Search, memory and action changes still require their own diagnostics and controlled tests.

No long run has been launched. The changed allocation is two treatments across three starting seeds, giving more replication of the unresolved comparison instead of spending a third of the main budget on the unsupported fast-decay schedule.

## Evidence

- [Original automatic report](../.worktrees/controlled-ablations/stockmarket-training/runs/two-hour-imitation-2026-11-06/REPORT.md)
- [Scores, comparisons and completion state](../.worktrees/controlled-ablations/stockmarket-training/runs/two-hour-imitation-2026-11-06/results.json)
- [Frozen manifest](../.worktrees/controlled-ablations/stockmarket-training/runs/two-hour-imitation-2026-11-06/manifest.json)
- [Endpoint improvement chart](../.worktrees/controlled-ablations/stockmarket-training/runs/two-hour-imitation-2026-11-06/endpoint-improvements.png)
- [Training diagnostics, not validation scores](../.worktrees/controlled-ablations/stockmarket-training/runs/two-hour-imitation-2026-11-06/training-diagnostics.png)
