# Main/master release verification — 4 November 2026

The shared-engine work is integrated and published on:

- `stockmarket-game-engine`: `main`.
- `stockmarket.js`: `main`, commit `76d6282`.
- `stockmarket-tv`: `master`, commit `b6e9d18`.
- `stockmarket-old` remains on its existing `main`; no legacy code changed.

The parent pins the exact tested child commits. The independent cash-dock and suspension prototype
worktrees were retained. They are not additional repositories or required dependencies.

## Behaviour checks

- Web/backend: all 231 tests pass, including the complete-game Convex-versus-memory replay,
  existing mixed human/NPC games, chance-card phases, company roles and legacy compatibility.
- Shared and headless packages: independent type checks pass; all eight headless tests pass.
- TV: 23 UI/game-presentation tests and nine installer tests pass.
- The web UI source is unchanged by the extraction. The previously recorded TV cash-rounding
  correction matches the existing shared/backend £500 rule.
- Web lint, production build and validation of 23 referenced assets pass.

## Production publication

Convex production deployment completed at `https://effervescent-flamingo-244.convex.cloud`:
code generation, type checking and schema validation passed, with no deleted indexes.
A post-deployment read-only public TV board query completed successfully.

The frontend build explicitly used that production backend URL and was uploaded to the existing
Pages project. Deployment: <https://dddf761d.stockmarket-convex.pages.dev>.
<https://stockmarket.samfelton.com> serves the exact deployed JavaScript/CSS build. The browser
rendered the authenticated home screen with the existing Join, Spectate and Start game controls.
No gameplay was performed in an existing user's production game.

## Prepared TV build

The [master Android build](https://github.com/SamFeltip/stockmarket-tv/actions/runs/41800526690)
passed tests, `assembleDebug`, `lintDebug` and a byte-for-byte comparison of every built web file
against the files inside the APK. All 45 web assets are present.

The prepared APK was downloaded to the ignored local path:

`stockmarket-tv/.release/prepared-b6e9d18/stockmarket-tv-debug.apk`

SHA-256: `c8507f21d4136ea22140223d8e1f47717045a04443cf6612f83a5c1649ed9f1f`.
`SHA256SUMS` and `BUILD.txt` sit alongside it. This is a debug/sideload test build using a CI test
certificate. It is not a store-signed release and may not update an existing installation signed
with a different key. The existing production keystore and credentials were absent on this Mac;
they were not replaced. Store signing requires restoring the original materials described in
`stockmarket-tv/PUBLISHING.md`. No physical TV installation, remote-control testing or store
submission was performed.
