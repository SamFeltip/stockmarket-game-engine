# TV merge readiness

> Historical record, not current setup or release instructions. Moved from `stockmarket-tv/MERGE_READINESS.md`; preserved from the pre-extraction project history. Paths and validation counts in the text describe that work. Use [setup](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/SETUP.md), [deployment](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/DEPLOYMENT.md) and [release verification](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/RELEASE_VERIFICATION.md) for the current workspace.

Verified 3 November 2026 for `poc/share-suspended` → `master`, together with
`poc/player-cash-dock` → `main` in the web/backend repository.

## Changes prepared

- Removed offline sample-game routing, preview buttons, Rights Issue/Share Suspended demos and demo-only CSS. Old `?demo=1` URLs now open the real application.
- Moved the public sample board to a test-only fixture; production imports no sample game.
- Preserved connected Rights Issue and suspension mutations, TV token controls and public-card isolation.
- Fixed live Government Loan event queuing so the TV shows its money animation. Added event/reconnect and connected-screen regressions.
- Refreshed vendored website presentation sources and their source hashes from the companion web worktree.

## Validation

A temporary clean copy containing only repository files and prepared additions was installed with `npm ci --ignore-scripts`:

- `npm test`: 22 UI/presentation tests and 9 installer tests passed. Installer tests use test doubles and do not install on a device.
- `npm run build`: strict TypeScript and Chrome 80-targeted production bundle passed.
- Older-WebView tests passed with `Array.prototype.toSorted` disabled.
- Browser smoke checks: the unconfigured build shows configuration guidance; the configured build opens the real home screen even at `?demo=1&view=rights`, connects to the backend, and opens the remote lobby-code keyboard without a preview button.

The companion backend passes 219 tests, including complete six-period phone/TV-controlled games, NPC resumption after Rights Issues, suspended-price settlement, private-card isolation and legacy-game compatibility. See its `MERGE_READINESS.md` for details.

## Merge and release

The branch contains the current local `master`; no merge was performed. Merge the coordinated web/backend changes into `main` and deploy them before distributing this TV build. Use the same Convex deployment as the phone app and set `VITE_PHONE_URL` to its matching frontend.

To refresh presentation sources before the web branch is merged:

```sh
STOCKMARKET_WEB_SOURCE=../../stockmarket-convex-cash-dock/ node scripts/sync-presentation.mjs
```

After both merges the default sibling `stockmarket-convex` source works again.

No backend deployment, APK build/install or store release was performed. This environment has no configured Android SDK/JDK. Physical TV remote, WebView, overscan, QR scan and iPhone standalone safe-area verification remain release-device checks.
