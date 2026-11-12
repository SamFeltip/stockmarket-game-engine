import type { ChanceOffer, StockPrice } from "../packages/game-contracts/src";
import type { QueryContext, Document_ } from "./model";
import { chanceStockKey, loanAmount } from "../shared/chance-cards";
import { rightsAvailable, rightsMaximum, rightsPriceFor } from "../shared/rights-issue";
import { rightsPurchase } from "../packages/npc-engine/src/chance";
import { debentureInHand } from "../shared/debenture";
import { debentureOffers } from "./debenture";
import { playerPeriodInsights, retainedDebentures } from "./dealing";

export async function chanceOffers(context: QueryContext, game: Document_<"games">,
    self: Document_<"players">, players: Document_<"players">[], prices: readonly StockPrice[]): Promise<ChanceOffer[]>
{
    const cards = (await retainedDebentures(context, game, self._id))
        .concat(await playerPeriodInsights(context, self._id, game.currentPeriod));
    const debentures = cards.some((card) => card.chanceKind === "debenture" && debentureInHand(card, game.currentPeriod))
        ? await debentureOffers(context, game, self) : [];
    const offers: ChanceOffer[] = [];
    for (const card of cards.filter((item) => item.gameId === game._id && item.stockKey === chanceStockKey
      && !item.used))
    {
        if (card.chanceKind === "debenture" && debentureInHand(card, game.currentPeriod))
        {
            for (const offer of debentures.filter((item) => !item.unavailableReason && item.amount !== null))
            {
                offers.push({ action: { kind: "debenture", insightId: card._id, stockKey: offer.stockKey },
                    amount: offer.amount! });
            }
        }
        else if (card.period === game.currentPeriod && card.chanceKind === "loan")
        {
            offers.push({ action: { kind: "government-loan", insightId: card._id }, amount: loanAmount(game.pack) });
        }
        else if (card.period === game.currentPeriod && card.chanceKind === "rights" && !card.resolved)
        {
            for (const price of prices)
            {
                const maximum = rightsMaximum(self.holdings.find((item) => item.stockKey === price.stockKey)
                    ?.quantity ?? 0, game.pack, true);
                const issuePrice = rightsPriceFor(game.pack, price.value);
                const quantity = rightsPurchase(price.value, maximum, self.cash,
                    rightsAvailable(players, price.stockKey), issuePrice);
                if (quantity > 0)
                {
                    offers.push({ action: { kind: "rights-issue", insightId: card._id, stockKey: price.stockKey },
                        amount: quantity * (price.value - issuePrice) });
                }
            }
        }
    }

    return offers;
}
