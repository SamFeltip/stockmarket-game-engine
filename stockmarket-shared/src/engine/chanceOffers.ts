import type { ChanceOffer } from "../packages/game-contracts/src";
import type { QueryContext, Document_ } from "./model";
import { chanceStockKey, governmentLoanAmount } from "../shared/chance-cards";
import { rightsAvailable, rightsEntitlement, rightsIssuePrice } from "../shared/rights-issue";
import { rightsPurchase } from "../packages/npc-engine/src/chance";
import { debentureOffers } from "./debenture";

export async function chanceOffers(context: QueryContext, game: Document_<"games">,
    self: Document_<"players">, players: Document_<"players">[]): Promise<ChanceOffer[]>
{
    const cards = await context.db.query("playerInsights").withIndex("by_player_period", (q) =>
        q.eq("playerId", self._id)).collect();
    const debentures = await debentureOffers(context, game, self);
    const offers: ChanceOffer[] = [];
    for (const card of cards.filter((item) => item.gameId === game._id && item.stockKey === chanceStockKey
      && !item.used && item.period <= game.currentPeriod))
    {
        if (card.chanceKind === "debenture")
        {
            for (const offer of debentures.filter((item) => !item.unavailableReason && item.amount !== null))
            {
                offers.push({ action: { kind: "debenture", insightId: card._id, stockKey: offer.stockKey },
                    amount: offer.amount! });
            }
        }
        else if (card.period === game.currentPeriod && card.chanceKind === "loan")
        {
            offers.push({ action: { kind: "government-loan", insightId: card._id }, amount: governmentLoanAmount });
        }
        else if (card.period === game.currentPeriod && card.chanceKind === "rights" && !card.resolved)
        {
            for (const price of game.prices)
            {
                const maximum = rightsEntitlement(self.holdings.find((item) => item.stockKey === price.stockKey)
                    ?.quantity ?? 0);
                const quantity = rightsPurchase(price.value, maximum, self.cash,
                    rightsAvailable(players, price.stockKey));
                if (quantity > 0)
                {
                    offers.push({ action: { kind: "rights-issue", insightId: card._id, stockKey: price.stockKey },
                        amount: quantity * (price.value - rightsIssuePrice) });
                }
            }
        }
    }

    return offers;
}
