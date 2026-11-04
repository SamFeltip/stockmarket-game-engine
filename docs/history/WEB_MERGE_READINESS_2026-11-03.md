# Web/backend merge readiness

> Historical record, not current setup or release instructions. Moved from `stockmarket-convex/MERGE_READINESS.md`; preserved from the pre-extraction project history. Paths and validation counts in the text describe that work. Use [setup](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/SETUP.md), [deployment](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/DEPLOYMENT.md) and [release verification](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/RELEASE_VERIFICATION.md) for the current workspace.

Verified 3 November 2026 for `poc/player-cash-dock` → `main`, together with
`poc/share-suspended` → `master` in the TV repository.

## Changes prepared

- Removed offline experiment pages, demo handlers, demo-only tests, standalone demo build configuration and tracked preview screenshots.
- Added a viewport-height normal-player round reveal for mouse/trackpad desktops, with compact fluid sizing and in-flow navigation. Touch-first tablet, suspension and spectator layouts retain their existing rules. Browser checks covered every reveal stage through the overview with six players; at a 577px browser height both the page and reveal panel fit without scrolling.
- Preserved the live cash dock, cash settlement, Government Loan, Debenture, Rights Issue, Share Suspended and public spectator flows.
- Fixed the Rights Issue selector regression to check the accessible company label with personal holdings.
- Added complete six-period phone- and TV-controlled game tests against the production Convex handlers. They exercise buying, loans, Rights Issue purchase/completion, suspension choices, preview/settlement parity, TV capability checks, duplicate progression and final standings. A separate regression verifies that real NPC scheduling resumes after Rights Issue completion.
- Included the dependency lockfile and previously ignored production logos, images and title font so fresh checkouts contain the assets used by the game. Asset validation checks both source and built output.

## Validation

A temporary clean copy containing only repository files and the prepared additions was installed with `npm ci --ignore-scripts` and checked with `npm run check`:

- ESLint: passed.
- 45 test files, 219 tests: passed, including complete mixed human/NPC games at all supported game lengths, legacy games, permissions, private-card isolation, debenture accounting and chance-card lifecycle checks.
- TypeScript and NPC-engine type checking: passed.
- Production build and 31 referenced asset checks: passed.

A browser smoke check of the production build, configured with the existing checkout's public Vite settings, reached the real sign-in screen. Browser gameplay was not exercised against a deployed backend; gameplay assertions use isolated Convex test databases and the production handlers. No production games or accounts were changed.

## Merge and release

1. Merge this branch into `main` and the companion TV branch into `master`. Both branches contain their current local target branch without conflicts; no merge was performed by this preparation.
2. Run the normal web deployment from `main`, which checks, deploys the backend, builds using the production Convex URL and deploys the phone frontend. These schema additions are optional; existing games keep their pinned catalogs and balances.
3. Configure the TV with that same backend and its matching phone frontend, then build and distribute the TV app. The new TV requires `rightsIssue:skip`, `rounds:beginSuspensions` and `rounds:skipSuspension` from this backend.
4. Verify phone purchases and skips, spectator skips, round progression, and final results on the release deployment and physical TV before store distribution.

No deployment, branch merge, APK install or store release was performed. Physical TV/WebView/remote and iPhone standalone safe-area checks remain device checks. The documented retained-debenture and £1,000 cash-rounding rules remain; Debenture payouts now use game-opening prices as requested; see `BOARD_GAME_DIFFERENCES_CURRENT.md` for differences from the retail account.

## Desktop sizing follow-up

Mouse/trackpad desktop browsers (at least 992px wide) now use an 80% root text/spacing scale across the web app. Viewport dimensions remain unchanged and touch-first tablets keep their existing scale. Desktop overview role rows retain their stacked design with compact portraits and spacing; content-sized grid minima prevent role text and badges from overflowing company cards or overlapping player totals. A six-player browser fixture with chairman, director and chairman bonus on every company fitted a 577px browser height with no page or overview scrolling; all role content stayed inside its card. Desktop home rendered at 12.8px root size and the tablet-width check retained 16px.

## Role and Debenture follow-up

Role assignment now enforces one chairman and one director per company across ordinary trades, Rights Issues, bonuses and all public/phone displays. Director priority is stored and recovered from complete historical trades for existing games. New regressions cover later qualifiers, vacancies, requalification, former chairmen, round persistence and buy/sell assigned-role labels. Debenture uses current personal holdings and period-zero opening prices, with a regression demonstrating 68,000 shares sold at £2 each for £136,000 regardless of purchase cost or later catalogue changes. Browser checks confirmed the sale labels/payout and assigned-role status in the desktop dialog and mobile drawer.

Follow-up validation: `npm run check` passed 223 tests in 47 files, lint, both type checks, build and all 31 asset references. The synced TV worktree passed 22 presentation tests, 9 installer tests and its production build. The existing development watcher loaded the updated functions; production was not deployed.

Rights Issue activation now uses the requested two instruction lines and a single horizontally scrolling row of compact portrait stock cards on mobile. The drawer fits its content; browser checks with six companies, long names and six-digit holdings confirmed no vertical card/list overflow, including the standalone safe-area layout. Desktop player header panels and the cash/chance-card footer retain their rounded outer corners.
