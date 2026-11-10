# Five-hour PPO comparison — 6 November 2026

Authorized duration: **five hours of training**, followed by at most two hours of validation, final evaluation and reporting. The manifest records exact launch and cutoff times. This shortens the 12–14-hour exposure proposed in the earlier findings.

Launched **10:52:13 GMT on 6 November 2026**. Training cutoff: **15:52:13 GMT**; overall evaluation/reporting deadline: **17:52:13 GMT**. Coordinator PID: **57095**. All six workers loaded successfully. Preparation passed the existing two gradient/schedule checks, the new balanced-evaluation integrity check, both 1,024-decision treatment smoke runs, fixed-imitation recovery to 2,048 decisions, and six complete evaluator games. Live progress is in the run's `status.json` and each worker's `state.json`.

## Frozen allocation

- Six CPU workers: ordinary PPO (`beta=0`) and fixed Morgan imitation (`beta=0.1`) from each original distilled start, seeds 19073, 29083 and 39089. The first and third starts were reused in the short screen; 29083 adds starting-seed coverage.
- Target **983,040 new decisions per worker**, equal exposure, approximately 4.3 hours ordinary and 4.9 hours fixed at the screen's throughput. Stop at the five-hour cutoff even if the target is incomplete. Faster workers stop at the target. These are planning estimates, not guaranteed runtimes.
- Keep architecture, schemas, reward, opponents and PPO settings unchanged. Use the verified common PPO/imitation gradient implementation. No fast-decay treatment, stronger opponents or architecture changes.
- Fresh paired training RNG seeds 619073, 629083 and 639089. Reserve disjoint million-game training blocks beginning at 1,490,000,000, 1,491,000,000 and 1,492,000,000. Preserve optimizer initialization within each pair; reset exposure/update counters and training RNG.
- Atomically save recoverable model/optimizer/RNG/counters every 1,024 decisions. Recovery skips a partial game; it does not claim bitwise simulator recovery.
- Preserve checkpoints at 0, 262,144, 524,288, 786,432 and 983,040 decisions. If time runs out, use the largest milestone completed by all six workers, selected only by exposure completion. Preserve extra checkpoints as diagnostics.

## Validation and test

Validation is deferred until training stops so it does not consume the requested training allocation. Evaluate every declared nonzero milestone up to the common endpoint on **256 Medium and 256 Hard shared validation deals**, alongside all three frozen starts and Morgan Hard. Reserve validation seeds beginning at 2,890,000,000, with the Hard tier offset by 100,000. Validation receives at most 90 minutes, leaving at least 30 minutes for final evaluation.

Select each run's checkpoint by maximum equal-weight Medium/Hard validation score, breaking ties toward the earliest milestone. Preserve `best-validation.zip` and common-endpoint `final.zip` separately. Selection is frozen before final test results exist.

Evaluate the six selected policies, three frozen starts and Morgan on **256 Medium and 256 Hard fresh final-test deals** beginning at 2,892,000,000, again with the Hard tier offset by 100,000. Deal schedules balance four to six players, seats and game lengths using the existing evaluator. Report tier and primary pairwise finishing scores, all three starting-seed differences, and a paired deal bootstrap interval for ordinary minus fixed imitation. This interval describes evaluation uncertainty conditional on the policies, not arbitrary future training seeds. Raw records also retain wealth, wins/ties and inference timing.

Missing balanced evaluation, numerical/legality errors or worker failures produce an explicit failure/incomplete status, with no recipe winner claim. Do not extend deadlines after viewing scores. Training reward is diagnostic, not validation performance. The final test is a field benchmark, not a direct Morgan matchup or the broader five-seed adoption protocol. No model deployment is authorized or performed here.

## Operation and artifacts

Implementation: `.worktrees/controlled-ablations/stockmarket-training/research/five_hour/`. Artifacts: `.worktrees/controlled-ablations/stockmarket-training/runs/five-hour-ppo-2026-11-06/`.

The coordinator owns independent worker process groups, enforces deadlines, keeps the Mac awake while running, and writes `manifest.json`, `source.tar.gz`, `status.json`, per-worker logs/checkpoints, validation/test game rows, `selection.json`, `results.json` and `REPORT.md`. It refuses to overwrite an existing run. Training stops safely on low disk space or nonfinite gradients. Previous experiment artifacts are preserved.

Seed reservations were checked against retained config/manifest/contract files and research code before launch. The manifest freezes source/checkpoint hashes and exact deadlines. Preparation and smoke checks are outside the five-hour training clock.
