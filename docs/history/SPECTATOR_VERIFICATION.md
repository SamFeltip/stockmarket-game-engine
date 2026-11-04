# TV and web spectator comparison

> Historical record, not current setup or release instructions. Moved from `stockmarket-convex/SPECTATOR_VERIFICATION.md`; preserved from the pre-extraction project history. Paths and validation counts in the text describe that work. Use [setup](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/SETUP.md), [deployment](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/DEPLOYMENT.md) and [release verification](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/RELEASE_VERIFICATION.md) for the current workspace.

Verified on 25 October 2026 against the current `stockmarket-tv` source and browser preview.

| Screen | Evidence |
| --- | --- |
| Lobby | Same lobby code, player portraits and names, player count, game length, joining QR panel, launch eligibility and empty-lobby prompt. Populated lobby panel dimensions match at 1280×720. |
| Live game | Same turn counter, period, six prices, starting-price changes, recorded sparklines, shares held, ranked portfolios, cash, holdings, net worth, combined wealth, invested wealth, latest purchase and public feed. Browser comparison of all five content panels matched; all main panel dimensions matched at 1280×720. |
| Trade animation | Same public buy/sell/pass event filtering, chronological queue, portrait and stock imagery, and shared 3500 ms duration. No historical trades replay when opening a game. |
| Reveals | Same stock order, insight display, 2500 ms reveal interval, stock summaries, price charts, player wealth and holdings. Browser verified stock advancement and a layout that fits 1280×720. |
| Round overview | Browser text comparison matched stock changes, player wealth changes and next-period controls. Tests also cover read-only viewers, TV-controlled games, unresolved hold decisions and the final-period Finish Game button. |
| Final results | Browser text comparison matched final rankings, player portfolios, share values and recorded price-history statistics. Keyboard selection of another player displays that player's portfolio. |
| Connection/loading | Reconnecting warning, loading display and missing-game message are present in the web spectator route, including while the initial board is loading. |

The source audit found matching presentation implementations for RoundReveal, RoundOverview, RoundWealth, StockPriceChart, FeedMessage, FinalHoldings, StockHistoryStrip, MobilePortfolio, stock-history, use-marquee, price-history, reveals, use-reveal-ready and round-preview after accounting for imports and public type declarations. Settlement calculations and presentation timing match exactly.

The desktop CSS is generated from the TV stylesheet with `node scripts/sync-spectator-styles.mjs`. It is scoped to the web spectator route and applies from 1000 px wide; smaller windows retain the responsive web layout. The generated CSS is checked in, so builds do not require the TV checkout.

Intentional platform differences: browser keyboard/mouse/touch controls replace remote instructions; the web creator's signed-in account controls their game instead of a TV device capability. Web lobby copy describes that creator rather than claiming the first phone player becomes host. QR codes use the active web origin so phones join the same deployment. TV home/recent-game navigation remains specific to the TV app.

Validation: all 129 tests, lint, TypeScript, production build and asset checks pass. Added `tests/spectator-display.test.tsx` for display coverage. Browser comparisons used identical offline data and did not create or modify production games. Physical-TV rendering was not re-tested in this audit.

## Main merge verification — 26 October 2026

Merged `origin/main` (`ea69bb9`) with the complete web spectator implementation (`072cd6b`) using a merge commit, retaining both histories. Incoming mobile trading actions, pass confirmation, profile-toggle alignment, trade quantity rules and public stock-order corrections remain in place. The themed spectator creation switch and spectator host controls remain in place.

Updated the sibling TV checkout to `e54a019` and refreshed desktop web spectator styles, including TV 1.3.1 summary spacing, focus indicators, scrollable rankings and wealth-change placement. The stylesheet sync now includes rules after the demo-only button, and extracts animation keyframes outside the scoped rules. Web cards and portfolio columns retain the TV client's defensive volatility ordering; a shuffled-input regression confirms holdings remain aligned without mutating the source data.
