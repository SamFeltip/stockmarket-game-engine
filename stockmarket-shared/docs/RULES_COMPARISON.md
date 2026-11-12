# Shared game rules versus the 1987 Stockmarket board game

Moved from `stockmarket-convex/BOARD_GAME_DIFFERENCES_CURRENT.md` in the web repository (commit `76d6282`). The shared engine now owns the rules; web and TV presentation notes retain their source links. See [release verification](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/RELEASE_VERIFICATION.md) for current validation.

Researched and compared on 16 October 2026. Retail-rule corrections from the BGG review added on 2 November 2026; implementation notes updated on 3 November 2026.

This tracked copy records current behavior. The local-only `local-notes/BOARD_GAME_DIFFERENCES.md` remains the original research snapshot. Rows marked **Aligned** are completed changes, rather than remaining differences.

## Current card-dealing behavior (introduced 3 November 2026)

As of 3 November 2026, new games deal the retail 108-card deck: the
92 recovered share-price cards, four +10% and four −10% cash/gold cards, and two
of each of the four retail chance cards (no Options), following the retail review below.
The four +10% and four −10% cash counts also match the patent’s Schedule of Cards (page 4).
Each player receives ten cards without replacement each round from the pinned
deck. Existing running games keep their original pinned catalogs.

Cash is shown as a private aggregate in the footer, including grey +0%. At period
end, the sum of everyone's dealt cash cards affects all remaining balances; the
adjustment is rounded to £500. Legacy imported `currency` cards keep their
per-player treatment, also rounding adjustments to £500. Government Loan and Debenture are implemented;
Share Suspended is implemented after stock and cash reveals, before the summary.
Rights Issue is implemented as one initiating bargain with a paused shareholder purchase sequence.
Legacy Option activation remains disabled. Debentures
are retained and sell bankrupt holdings at the game-opening price within the two-period claim window. Debenture retention and the claim window remain patent-based
behaviors; the retail review describes no retained cards.
See `stockmarket-shared/src/shared/chance-cards.ts`, `stockmarket-shared/src/shared/settlement.ts`, the web adapter `convex/launch.ts`, and
`tests/chance-cards.test.tsx`. The card rows below distinguish the current implementation from the earlier baseline;
other implementation notes retain their original research scope.

## Scope and sources

The likely reference is **Stockmarket! (Jordans Games, 1987)**, identified by [BoardGameGeek's English-edition listing](https://boardgamegeek.com/boardgameversion/28804/english-edition). This is an identification based on the title and matching mechanics; the user's physical edition has not been inspected.

The main rules source is the **“Description” section of [EP0297870A1, Board games](https://patents.google.com/patent/EP0297870A1/en#description)**, which explicitly reproduces rules for a game named Stockmarket. It is a contemporary primary source, with a 1987 priority date and 1989 publication date. The [US patent in the same family](https://patents.google.com/patent/US4934707A/en#description) reproduces them too. These are patent-published rules, rather than a verified scan of the retail rules leaflet; edition-specific differences remain possible.

The application side below comes from **stockmarket-shared** and its **stockmarket-convex** adapter, including the shipped catalog. It is not an audit of the currently deployed database. Links to application files are relative to this document.

## Retail rules described in the BGG review (2 November 2026)

[Neil Palfreyman’s review of Stockmarket! (13 April 2006)](https://boardgamegeek.com/thread/106869/review-of-stockmarket) describes the retail game differently from the patent. Use these reviewed retail rules for the card comparisons below; retain the patent as a separate rules variant, not proof that the retail cards work the same way. The physical rules leaflet has still not been inspected.

| Area | Retail rules in the review | Earlier patent-based documentation |
| --- | --- | --- |
| Deck | 108 cards: 92 share movements, eight currency cards (four each ±10%), eight chance cards (two each of four types). | 110 cards, including two Options. |
| Government Loan Stock | One bargain to collect £10,000. | Same payout and turn cost. |
| Rights Issue | One bargain selects a company; every holder may immediately buy one extra share per two held, at £1 per extra share. | Grants 50% extra shares without a purchase payment. |
| Debenture | One bargain sells shares in a bankrupt company at that company’s opening price. | Retained card selling bankrupt holdings at the game-opening price within two periods. |
| Share Suspended | Choose a company at period end, just before price adjustment; keep its previous price. | Same price-freezing effect. |
| Option | Absent from the four retail chance-card types. | Reserves a trade price for up to three periods. |
| Card lifecycle | Return all cards, including unused chance cards; reshuffle and deal ten each period. Nothing carries over. | Allows retained Debentures and Options. |
| Currency rounding | Apply the shared currency percentage to spare cash, rounding to £500. | Round adjustments to £1,000. |

The review does not specify Rights Issue rounding, insufficient-cash handling or supply limits, nor a Debenture claim deadline beyond the card’s current-period lifetime. Do not import the patent’s details into those gaps. Its later replies include a separate digital adaptation with house rules; those are not retail rules.

Other evidence: the review confirms the six company names and gives Legal & General’s opening price as £4 and NatWest’s as £8 (new app games now also start NatWest at £8). It describes an agreed game length; the reviewer recommends at least four periods, rather than establishing the patent’s 6–10 as a retail requirement. The full retail starting-price chart and card frequencies remain unverified.

## Differences in ordinary games

Card, currency and lifecycle entries below use the retail review above. Other entries retain the earlier [patent rules comparison](https://patents.google.com/patent/EP0297870A1/en#description); **Aligned** labels on those entries refer to the patent, not independent verification of the retail leaflet.

| Area                  | Board-game rule                                                                                                | stockmarket-convex behavior and consequence                                                                                                                                                                                                                                                                          | Application evidence                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting funds | £60,000 in gold. | **Aligned:** hosts and guests now start with £60,000 cash. Existing players retain their stored balances. | [games.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/games.ts), `create` and `join` |
| Game length | 6–10 bargain periods. | **Aligned:** creation and lobby controls offer every length from 6 through 10 periods. The server validates these choices. Existing short lobbies must select a supported length before launch; games already playing retain their stored length. Internally, `periodCount` remains the final zero-based period index (5–9). | [CreateGame.tsx](https://github.com/SamFeltip/stockmarket.js/blob/main/src/CreateGame.tsx), [games.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/games.ts), [rounds.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/rounds.ts) |
| Share supply | 200,000 shares per company. | **Aligned in Classic:** the server, stock panel and trading form use a shared limit of 200,000 shares per company across all players. Frantic has a 10 million share limit per company. | [trading.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/trading.ts), [StockPanel.tsx](https://github.com/SamFeltip/stockmarket.js/blob/main/src/StockPanel.tsx), [TradeModal.tsx](https://github.com/SamFeltip/stockmarket.js/blob/main/src/TradeModal.tsx) |
| Permitted trade sizes | 1,000–5,000 in 1,000 steps; above that, 10,000 multiples.                                                      | **Differs from the patent:** ordinary purchases and sales accept any positive safe integer multiple of 1,000, subject to cash, holdings and supply limits. This includes 6,000 and 15,000 shares. | [rules.ts](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/stockmarket-shared/src/shared/rules.ts), [trading.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/trading.ts), [TradeModal.tsx](https://github.com/SamFeltip/stockmarket.js/blob/main/src/TradeModal.tsx), [trades.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/src/trades.ts) |
| Last-trader advantage | Last trader rotates clockwise between periods.                                                                 | **Aligned:** the opening seat advances by one each period, rotating the final-trader advantage too. The seat order within each period stays fixed. | [library.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/library.ts), `members`; [trading.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/trading.ts); [rounds.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/rounds.ts), `next`                          |
| Chairman              | At ≥100,000 shares, discard one revealed company card; earliest qualifier wins ties.                           | **Aligned (automatic):** qualification order is retained across periods and reset when holdings fall below 100,000. The chairman automatically cancels the worst revealed negative company card. In legacy games without qualification records, tied existing holdings use seat order.                                                                                                                                                                           | [schema.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/schema.ts), [trading.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/trading.ts), [rounds.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/rounds.ts)                                               |
| Director              | At 50,000–100,000 shares, discard one own company card; chairman takes precedence. One discard/company/period. | **Aligned (automatic):** each company has at most one director and one chairman. First qualification keeps the role while eligible; later buyers do not displace incumbents. The director cancels the worst negative card in their own hand, with chairman precedence and one cancellation per company per period. Both roles have investor badges; round reveals and the final overview show the cancelled value as a role bonus.                                                                                                                                                                                  | [StockPanel.tsx](https://github.com/SamFeltip/stockmarket.js/blob/main/src/StockPanel.tsx), [rounds.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/rounds.ts)                                                                         |
| Deck                  | Retail review: 108 cards (92 share, eight currency, eight chance); no Options.                                                                    | New games: **108 cards**, with two Share Suspended cards; ten are dealt per player without replacement each period. Existing games retain their pinned catalogs. | [catalog.ts](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/stockmarket-shared/src/catalog.ts), [library.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/library.ts), `deal`; [README.md](https://github.com/SamFeltip/stockmarket.js/blob/main/README.md), “Original assets and missing source data” |
| Gold movements        | Aggregate currency cards affect everyone; retail review rounds to £500 (patent: £1,000).                                             | **Aligned with retail rounding:** all dealt cash cards jointly affect remaining balances, with the adjustment rounded to £500. Imported legacy currency cards retain per-player handling and also round adjustments to £500. | [catalog.ts](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/stockmarket-shared/src/catalog.ts), [rounds.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/rounds.ts)                                                                              |
| Share Suspended       | Freeze one company's price at period end.                                                                      | Implemented: choose after stock and cash reveals, in the period’s rotated play order, before summary and settlement. Use or confirmed skip spends one physical card; spectator displays can override with a confirmed skip. The old Hold Stock Price path is separate. | [rounds.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/rounds.ts), `hold`; [catalog.ts](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/stockmarket-shared/src/catalog.ts)                                                                      |
| Government Loan Stock | Spend a turn to collect £10,000.                                                                               | Implemented on this branch: consumes one card and one turn to pay £10,000.                                                                                                                                                                                                                                   | [trading.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/trading.ts), [catalog.ts](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/stockmarket-shared/src/catalog.ts)                                                                            |
| Debenture | Retail review: spend a bargain to sell bankrupt-company shares at the company’s opening price; no retention. | Sell all current holdings in the chosen bankrupt company at its recorded game-opening price. Purchase prices and FIFO lots do not affect the payout. Unused physical cards still carry across deals and the two-round claim window remains. **Differs from retail:** claim window and retention. | [debenture.ts](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/stockmarket-shared/src/engine/debenture.ts), [commands.ts](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/stockmarket-shared/src/engine/commands.ts), [DebentureModal.tsx](https://github.com/SamFeltip/stockmarket.js/blob/main/src/DebentureModal.tsx) |
| Rights Issue          | Spend a bargain; all holders may buy one extra share per two held in the chosen company at £1 per extra share.                                           | Implemented: two cards are dealt per deck. The activating player chooses a company and uses one bargain; eligible holders respond in cyclic play order from that player. The purchase flow pauses trading, offers each holder up to half their opening holding at £1 each, and resumes after all choices. | [trading.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/trading.ts), [rounds.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/rounds.ts)                                                                              |
| Option                | Absent from the retail review; the three-period Option belongs to the patent variant.                             | Excluded from new retail decks. Existing pinned games may still have Options, displayed as unavailable; activation is disabled. | [schema.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/schema.ts), [trading.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/trading.ts)                                                                              |

## Legacy imported-card mechanics

The following notes describe the earlier catalog’s legacy `currency` and hold-stock paths. The branch’s new cash/chance cards are described above; these legacy paths do not establish their behavior.

### Currency settlement differs even if cards are restored

`rounds.next` selects `currency` insights **belonging to each individual player**, sums that player's values, and applies:

```text
new cash = max(0, old cash + roundToNearest500(old cash × own currency-card sum))
```

Consequently, importing gold/currency cards alone would not implement the shared gold adjustment described in the comparison table. For example, if Alice alone held a +10% currency insight and Alice and Bob each had £65,000 left, the current code would give Alice £71,500 and leave Bob at £65,000. Its adjustment now uses the retail review’s £500 rounding, while retaining this legacy owner-only scope. See [rounds.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/rounds.ts), `next`.

### Hold-stock support needs catalog data

`rounds.hold` lets the card owner select one tradable company, or resolve the insight without selecting one. Selected companies are added to `game.suspended`, and settlement suppresses their price movement. The host cannot settle while a dealt hold-stock insight remains unresolved.

The [existing integration test](https://github.com/SamFeltip/stockmarket.js/blob/main/tests/game.test.ts) injects currency and hold-stock fixtures to exercise this code. Fixtures do not make these cards part of the shipped deck. The [README](https://github.com/SamFeltip/stockmarket.js/blob/main/README.md) records that the recovered original database also lacked these special records.

## Digital presentation and administration

The application replaces physical bookkeeping with accounts, lobby codes, server validation, persistent games and live updates. The host launches play and must trigger settlement/continuation, including the final settlement. Round-end reveals are animated independently in each browser. Holdings, cash and net worth are available through the shared board data, and trades appear in an activity feed. See [games.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/games.ts), [board.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/board.ts), [RoundEnd.tsx](https://github.com/SamFeltip/stockmarket.js/blob/main/src/RoundEnd.tsx) and [library.ts](https://github.com/SamFeltip/stockmarket.js/blob/main/convex/library.ts).

The [edition listing](https://boardgamegeek.com/boardgameversion/28804/english-edition) and [game listing](https://boardgamegeek.com/boardgame/2963/stockmarket/ratings?rated=1) identify a 2–6-player game. **Differs from the listed minimum:** the application requires four to six players, including NPCs, before launch. Both lobby controls and server validation enforce this roster size.

Stock details now show investor faces with share counts and missing-photo fallbacks, plus a responsive Recharts line chart of each company’s recorded prices. New games retain a starting snapshot and one snapshot per settled round, including the final round. Older games start recording from their current known price; unavailable historical prices are not reconstructed. The chart exposes only settled prices. On narrow screens the sections stack and tabs scroll horizontally; short screens scroll the stock panel vertically.

## Limits of this comparison

- The shipped companies are Trusthouse Forte, UB, Legal & General, Thames, Saatchi & Saatchi and Natwest, with starting prices £2, £2.50, £4, £5.50, £7.50 and £8 respectively. NatWest’s opening price now matches the review; existing games retain their recorded prices. The full retail starting-price chart and exact share-card frequencies remain unverified. See [catalog.ts](https://github.com/SamFeltip/stockmarket-game-engine/blob/main/stockmarket-shared/src/catalog.ts).
- The retail review explicitly requires all cards to be returned and reshuffled each period. Retaining a chance card would conflict with that account.
- Earlier implementation work addressed starting cash, share supply, game length, minimum players, period turn rotation and trade sizes. The current minimum-player and trade-size differences are recorded above. The later card changes are described above; the retail-rule corrections in this update change documentation only.
- Historical validation at the original comparison: 27 tests, TypeScript, production build and 27 asset references. This is not the current test count; see the linked release verification.
- Browser layout checks: sample game data at desktop, phone and short landscape dimensions, including 320 × 568; investor photos load, selected-stock history changes correctly, and the page has no horizontal overflow.
- Evidence: `tests/board-rules.test.ts` covers starting funds, shared supply, player minimum, length validation, permitted purchases/sales, rejected transactions and full six/ten-period games with rotating seats. `tests/errors.test.ts` checks cash entry and quantity-button boundaries.

### Automatic company roles (2 November 2026)

Role bonuses are price corrections, not cash payments. Every original company card is revealed, then one positive correction cancels the selected negative card at the end of that company's reveal. Each company card in the overview has a footer listing its sole chairman and director, with player portraits and role badges. Only the player whose power cancelled a card receives a bonus amount and description, including when animations were skipped. The same roles and bonuses appear in web spectator and standalone TV views. Settlement uses the same selection as player and spectator previews, before the zero-price floor is applied. Positive and zero cards are never discarded. A held price remains held. Role qualification comes from current holdings, applies immediately to human and NPC trades, and survives period changes.

Trade events retain the actor's company role before and after the trade. The trade pop-up announces new roles and resignations. Feed entries show only the badge and small grey role label below the player's name, based on that historical event rather than current holdings. Feed avatar wrappers reserve space around the top-left badge so the scrolling feed does not clip it. This covers player, web spectator and standalone TV displays. Trades in unrelated companies and passes do not inherit a role badge.

## Rights Issue implementation choices (3 November 2026)

The retail review establishes the £1 price, one new share per two held, and one initiating bargain.
Shareholder choices do not consume bargains or advance the period. The initiating bargain is recorded
and consumed once the issue completes; its original turn stays on screen during all choices.
Allowances are fixed from holdings when the card is activated. An eligible holder can buy any whole
number from zero (skip) to that allowance, within cash; an odd holding rounds down. No debt is created.
Any company can be selected, including bankrupt companies and companies without shareholders.
If nobody holds the selected stock, activation spends the initiating bargain without opening a purchase queue. The existing bank inventory limit is retained and shared across the queue; ordinary trading lot
restrictions do not apply to this special purchase.
These rounding, cash, and inventory details are implementation choices where the retail review is silent,
not rules imported from the patent. NPC holders accept profitable offers within cash and otherwise skip.
An authoritative short completion delay preserves the final purchase animation before normal play resumes.

### Rights Issue rules audit (3 November 2026)

Checked the implementation against the retail review summarized above, rather than the patent:
£1 per additional share, at most one new share per two originally held, optional choices for every
existing holder, one initiating bargain, and no other turn or period advancement during choices.
The two Rights Issue cards are part of the 108-card deck; activation spends the dealt card and
unused cards do not carry into the next period. Existing tests cover ownership, stale/replayed requests,
cash and bank limits, NPC holders, public feed events, and resuming/closing after the final choice.
Production-handler release tests cover complete phone- and TV-controlled games plus NPC scheduling
after Rights Issue completion; offline previews have been removed.
The rules-source limitations and rounding/supply implementation choices above still apply.

### Role exclusivity and Debenture payout correction (3 November 2026)

Only one chairman and one director can hold office in each company. Director qualification priority survives periods; dropping below the threshold releases it, and a retiring chairman cannot displace an existing director. Older games recover director qualification from complete recorded trade history, with stable seat order used only when history cannot explain imported holdings. Purchases in Rights Issues use the same role rules. Buy and sell dialogs/drawers show “Director role assigned” (and the chairman equivalent) while occupied.

Debenture offers and redemption use the player’s current holding count multiplied by the original game-opening price, taken from period-zero history. Legacy games without that snapshot use the catalogue opening price. Subsequent catalogue changes do not override a recorded opening quote.

### Cash rounding and NatWest opening price (3 November 2026)

Cash adjustments now round symmetrically to the nearest £500, including imported legacy
currency cards. Existing balances are preserved rather than rounded independently. Shared
settlement drives player and spectator previews and server settlement for human and NPC players.
The remaining 1,000 increments govern share quantities, not pounds, and are unchanged.
NatWest now opens at £8 in new games. Seeding corrects the old £9 catalog default without
rewriting saved game prices or opening-price history.
