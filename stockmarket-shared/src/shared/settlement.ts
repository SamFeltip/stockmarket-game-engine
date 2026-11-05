import { cashStockKey } from "./chance-cards";

interface Price { stockKey: number; value: number }
interface Insight { stockKey: number; playerId: string; value: number }
interface Stock { key: number; display: boolean; name: string }

export function settledPrice(opening: number, change: number): number
{
    return Math.max(0, Math.round((opening + change) * 100) / 100);
}

export function roundPrices(prices: Price[], insights: Insight[], stocks: Stock[], suspended: number[])
{
    return prices.map((price) =>
    {
        const stock = stocks.find((item) => item.key === price.stockKey);
        const change = stock?.display && !suspended.includes(price.stockKey)
            ? insights.filter((insight) => insight.stockKey === price.stockKey)
                .reduce((sum, insight) => sum + insight.value, 0) : 0;

        return { ...price, value: settledPrice(price.value, change) };
    });
}

/** Each card occupies an equal fraction of its stock's fixed-width round column.
 * Compute every point from the opening price so a temporary dip below zero does
 * not change the settlement rules for the remaining cards. */
export function roundPriceSteps(prices: Price[], insights: Insight[], stocks: Stock[], suspended: number[],
    allInsights: Insight[] = insights)
{
    return prices.filter((price) => stocks.some((stock) => stock.key === price.stockKey && stock.display))
        .map((price) =>
        {
            let change = 0;
            const cards = insights.filter((card) => card.stockKey === price.stockKey);
            const count = allInsights.filter((card) => card.stockKey === price.stockKey).length;
            const values = cards.map((card) =>
            {
                change += card.value;

                return settledPrice(price.value, suspended.includes(price.stockKey) ? 0 : change);
            });

            return { stockKey: price.stockKey, values, count };
        });
}

export function roundCash(player: { _id: string; cash: number }, insights: Insight[], stocks: Stock[])
{
    const change = insights.filter((insight) => insight.playerId === player._id
      && stocks.some((stock) => stock.key === insight.stockKey && stock.name === "currency"))
        .reduce((sum, insight) => sum + insight.value, 0);

    // New board-game cash cards affect everyone, just like company-price cards.
    // Round the adjustment, not the player's existing balance, to the nearest £500.
    const cashPercent = Math.round(insights.filter((insight) => insight.stockKey === cashStockKey)
        .reduce((sum, insight) => sum + insight.value, 0) * 100);
    const adjustment = Math.sign(cashPercent) * Math.round(player.cash * Math.abs(cashPercent) / 100 / 500) * 500;

    // Imported legacy currency cards still affect only their owner, using the same £500 rounding.
    const legacyAdjustment = Math.sign(change) * Math.round(player.cash * Math.abs(change) / 500) * 500;

    return Math.max(0, player.cash + legacyAdjustment + adjustment);
}

export function portfolioWorth(player: { cash: number; holdings: { stockKey: number; quantity: number }[] },
    prices: Price[])
{
    return player.cash + player.holdings.reduce((total, holding) => total + holding.quantity
      * (prices.find((price) => price.stockKey === holding.stockKey)?.value ?? 0), 0);
}
