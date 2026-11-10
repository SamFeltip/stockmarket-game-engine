# Two-hour experiment before the next long training run

Status: **completed successfully on 6 November 2026 at 10:27:41 GMT**, after starting at 09:02:37 GMT. All six training budgets and all 2,304 screening policy-games completed within the two-hour cap. See [findings and revised long-run plan](TWO_HOUR_FINDINGS_AND_LONG_RUN_2026-11-06.md). The protocol below records the predeclared experiment; no long run has been launched.

Run artifacts and automatic results: [experiment directory](../.worktrees/controlled-ablations/stockmarket-training/runs/two-hour-imitation-2026-11-06/). [Live status](../.worktrees/controlled-ablations/stockmarket-training/runs/two-hour-imitation-2026-11-06/status.json) and [frozen manifest](../.worktrees/controlled-ablations/stockmarket-training/runs/two-hour-imitation-2026-11-06/manifest.json) record effective budgets and failures. Preparation passed four Python checks, two Node parity checks, three short training runs, checkpoint recovery and a 72-game evaluator/report smoke test.

## Decision this experiment should inform

Should the next long PPO run retain Morgan imitation, remove it, or gradually remove it?

Run one controlled comparison with three treatments. Keep opponents, model size, inputs, actions and reward unchanged. Stronger opponent leagues, search and recurrent memory remain later experiments. Two hours is enough to screen early learning and verify the training machinery; it is not enough to establish a learning ceiling or prove superiority to Morgan.

The previous strongest model peaked after approximately 5.4 hours of fine-tuning. A weak first hour cannot establish that a treatment will fail over a full run.

## Experiment matrix

Use two existing distilled starts: `replay-seed19073/selected.zip` and `replay-seed39089/selected.zip`, from the overnight training-cycle directory. Each start supplies identical copies to all three treatments, giving six runs. These are two paired starting seeds, not six independent replications or fresh end-to-end training runs.

| Arm | PPO imitation coefficient | Question |
|---|---|---|
| A — No imitation | `beta = 0` throughout | Does removing the teacher constraint help? |
| B — Gradual removal | `beta(n) = 0.1 × max(0, 1 − n / 131072)` | Does early imitation help before unrestricted PPO takes over? |
| C — Fixed imitation | `beta = 0.1` throughout | Does the current regularizer preserve useful play? |

Here `n` is the number of new learner decisions since the distilled start. Freeze this schedule before launch. The decay reaches zero halfway through the target budget, leaving a further 131,072 decisions without imitation. Evaluate the hypothesis that imitation is a useful starting aid rather than a permanent objective; do not assume its penalty is already known to be harmful.

**Target exposure:** 262,144 new decisions per run, or 1,572,864 across the six runs. Use complete 256-decision rollout boundaries. Preserve checkpoints at 0, 65,536, 131,072, 196,608 and 262,144 decisions. Save the last recoverable state on interruption as well.

Hold the existing 512×512 actor/critic architecture, 320 inputs, masked action vocabulary, terminal-rank-plus-small-wealth reward, opponent schedule, learning rate, rollout length, minibatch size and PPO epochs fixed. Preserve identical policy and optimizer starting state within each pair. Record and consistently handle PPO counters and random-generator state. Use the same fresh game-seed schedule across arms within a starting seed, with separate schedules between starting seeds. Policies will generate different trajectories; shared deal seeds do not make those trajectories identical.

Use one common update implementation for all arms: the PPO gradient plus `beta` times the imitation gradient, followed by the same combined gradient clipping. Verify that beta zero reproduces the ordinary PPO update on a fixed batch. Teacher queries must not alter policy action sampling or environment randomness. Record their additional wall-time cost rather than claiming equal compute from equal decisions.

## Preparation before the timed run

Implement the coefficient schedule, common trainer, bounded coordinator and report generation before starting the experiment clock. Run focused checks for zero/fixed/decaying coefficients, legal masks, hidden-information boundaries, checkpoint recovery and a complete game. This preparation is additional engineering time, not part of the two-hour compute run.

Freeze a manifest containing source revision, checkpoint hashes, schemas, treatment settings, seed ranges, deadlines and analysis rules. Check that new training and screening seed ranges do not overlap any retained experiment. Preserve original artifacts; write this experiment to a new directory. No deployment is part of this screen.

## Two-hour wall-clock schedule

The two-hour cap includes launch checks, training, screening evaluation and reporting. The coordinator must enforce deadlines and report incomplete work instead of extending the run.

| Minutes | Work | Budget rule |
|---|---|---|
| 0–10 | Load and verify all six runs; short concurrent throughput and evaluator calibration | Training calibration decisions count toward each arm's exposure; discard calibration evaluation outcomes from analysis |
| 10–85 | Continue the six treatments under a fixed resource allocation | Stop each at 262,144 decisions; stop all training at minute 85 |
| 85–110 | Evaluate matched checkpoints, both frozen starting models and Morgan | Fixed shared screening deals; no more gradient updates |
| 110–120 | Validate completeness, calculate paired comparisons and save charts/report | Stop at minute 120 even if some work is incomplete |

Run training workers concurrently only within measured memory and CPU limits. Give all arms equivalent scheduling priority; if six workers cannot run safely, use balanced round-robin blocks rather than finishing one arm first. Throughput from the overnight run is only a planning reference because contention and teacher-label overhead can differ.

At minute 85, use the largest checkpoint milestone completed by **all six** runs. This choice depends only on exposure completion, never on scores. Faster arms' extra checkpoints remain diagnostic artifacts and do not enter the primary comparison. If the common checkpoint is below 262,144 decisions, label the screen truncated. At 131,072 decisions, the decaying arm has only just reached zero; below that it has not reached zero. Neither establishes the effect of a sustained unconstrained phase.

## Screening evaluation

Use fresh screening deals that will never be reused as the final test for the long run. Evaluate nine policies: the six matched training checkpoints, their two frozen distilled starts and Morgan Hard. All receive the same external NPC-field schedule, with Medium and Hard difficulties weighted equally and seats, player counts and game lengths balanced as closely as the sample allows.

The target is **128 Medium + 128 Hard deals per policy**, or 2,304 policy-games. This is a pilot evaluation, not the 2,048-deal-per-protocol confirmation proposed for the long run.

During the first ten minutes, benchmark evaluator throughput using a separate calibration seed range. Before inspecting any screening score, choose either the target budget or **64 Medium + 64 Hard per policy** if the target cannot fit the 25-minute evaluation window with 20% time margin. If even the smaller balanced budget cannot fit, mark the planned screen infeasible and report infrastructure findings; do not silently omit a treatment or extend the clock.

Evaluate every policy over the schedule in balanced deal blocks so that a deadline cannot leave one arm fully tested and another untested. Only report primary comparisons on the shared completed deal set. If the frozen budget is incomplete, label results incomplete and make no winner recommendation from them.

Primary metric: the equal-weight Medium/Hard pairwise finishing score. Secondary metrics: separate tier scores, whole-game win rate, wealth, game/decision counts, legal-action fallbacks, runtime and inference latency. Morgan's result is a field reference, not a direct head-to-head score against the candidate.

Evaluate the common-budget endpoint, not whichever checkpoint looks best. This keeps checkpoint selection from contaminating the short comparison and bounds evaluation cost. Retain intermediate checkpoints and training metrics for future inspection, but do not describe training reward as held-out playing strength.

## Analysis and decision rules

For each starting seed, calculate A−C, B−C and B−A, plus each arm's change from its own frozen start. Report the two seed results separately and their equal-weight mean. Bootstrap paired game deals, preserving policy comparisons and aggregating Medium and Hard with equal weights. Describe intervals as conditional evaluation uncertainty; two starting seeds cannot establish general training-seed reliability. All three comparisons are exploratory screening results, not confirmatory significance claims.

| Outcome | Decision for the long run |
|---|---|
| One arm beats both others by at least 2 primary-score points on average, has positive differences in both seeds, and no observed tier regression worse than 2 points versus fixed imitation | Prioritize that arm as a **provisional lead**; retain fixed imitation as a long-run control, or ordinary PPO if fixed imitation leads |
| No clear lead, or broad uncertainty | Carry ordinary PPO and fixed imitation into the longer comparison; retain gradual removal too if it is within 1 point of the best mean score |
| An arm loses at least 3 primary-score points versus its own starting model in both seeds | Flag early regression; investigate before expanding its budget, without treating this as proof of its long-run ceiling |
| Bugs, invalid actions, nonfinite updates, checkpoint mismatch or incomplete balanced evaluation | Fix the issue; do not select a winning recipe |
| Target exposure not reached | Treat as a feasibility/early-learning pilot; do not claim the full decay experiment completed |

Report interval widths alongside these practical thresholds. A positive point estimate with an interval spanning zero is uncertain. Do not promote a model, declare it better than Morgan, or discard all slower-learning alternatives on this screen alone.

## Deliverables at minute 120

- An immutable run manifest, effective budgets, hashes and deadline/completion record.
- Six recoverable training runs with model/optimizer state, random states, exposure counters and intermediate checkpoints.
- A compact results table: each seed × arm, its starting score, endpoint score, change, and Medium/Hard breakdown.
- Paired-comparison intervals, a chart of endpoint improvements, and training-reward/optimizer diagnostics clearly labelled as training metrics.
- Throughput, teacher-label cost, elapsed time and any incomplete work.
- A short recommendation: provisional lead, controls to preserve, and unresolved questions for the long run.

## What follows in the long run

Allocate enough duration to observe beyond the previous 5.4-hour peak. Confirm the shortlisted regularization recipes across additional independent training seeds, with equal decision budgets and a predeclared validation schedule. Use new final-test deals after recipe and checkpoint selection. Keep the substantial-margin acceptance criteria in the main plan.

Once the regularization comparison is resolved, test stronger opponent training as a separate controlled change. Search, memory and action-coverage changes require their own diagnostic evidence and experiments. This two-hour run chooses what to investigate next; it does not replace long-run confirmation.
