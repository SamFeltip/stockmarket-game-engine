import { gameStocks } from "./packRules";
import type { QueryContext, Document_ } from "./model";
import { bankruptcyPeriod } from "../shared/debenture";

export async function debentureOffers(context: QueryContext, game: Document_<"games">, player: Document_<"players">)
{
    const history = game.priceHistory ?? [];
    const stocks = (await gameStocks(context, game)).filter((stock) => stock.display);

    return player.holdings.filter((holding) => holding.quantity > 0
      && stocks.some((stock) => stock.key === holding.stockKey)
      && game.prices.some((price) => price.stockKey === holding.stockKey && price.value <= 0)).map((holding) =>
    {
        const bankrupt = bankruptcyPeriod(holding.stockKey, history, game.currentPeriod);
        const stock = stocks.find((item) => item.key === holding.stockKey)!;
        const opening = history.find((snapshot) => snapshot.period === 0)?.prices
            .find((price) => price.stockKey === holding.stockKey)?.value ?? stock.startingValue;
        const unitPrice = Number.isFinite(opening) && opening > 0 ? opening : null;
        const amount = unitPrice === null ? null : Math.round(holding.quantity * unitPrice * 100) / 100;
        const claimUntilPeriod = bankrupt === null ? null : bankrupt + 1;
        let unavailableReason: string | null = null;
        if (claimUntilPeriod === null)
        {
            unavailableReason = "Bankruptcy date is unavailable.";
        }
        else if (game.currentPeriod > claimUntilPeriod)
        {
            unavailableReason = "The two-round claim window has ended.";
        }
        else if (amount === null)
        {
            unavailableReason = "The game opening price is unavailable.";
        }

        return { stockKey: holding.stockKey, quantity: holding.quantity, amount,
            unitPrice, claimUntilPeriod, unavailableReason };
    });
}
