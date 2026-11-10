# Best model training curves

PPO + imitation, seed19073: strongest learned entrant in the fresh 60-entrant competition. This does not establish superiority to Morgan or other nearby models.

The timeline covers fine-tuning only. At zero hours, the inherited replay checkpoint uses its existing validation result. Later timestamps are evaluation completion minus evaluation duration, relative to the recorded worker launch; they approximate checkpoint evaluation start, include evaluation overhead, and are not pure optimizer time. All 15 complete fine-tuning validation checkpoints are included. Training continued beyond the last evaluated checkpoint; that unevaluated tail is not extrapolated.

Primary = equal-weight Medium/Hard pairwise finishing score. Curves reuse validation deals and drove checkpoint selection; final-test scores use a separate set. No curve smoothing or confidence claims are applied. The final bar chart shows point estimates, not a significance test.

Sources: `/Users/samfelton/Documents/Code/stockmarket/.worktrees/controlled-ablations/stockmarket-training/runs/training-cycle-2026-11-05/regularized-seed19073`, the replay seed19073 selection, and the three final evaluation summaries.

Recreate with the training virtual environment: `python docs/training-charts-2026-11-06/plot.py`. Data: `validation-history.csv`.
