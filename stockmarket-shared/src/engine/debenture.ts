import { gameStocks } from "./packRules";
import type { QueryContext, Document_ } from "./model";
import { bankruptcyPeriod } from "../shared/debenture";

export async function debentureOffers(context: QueryContext, game: Document_<"games">, player: Document_<"players">)
{
    if (game.pack === "tech")
    {
        return techDebentureOffers(context, game, player);
    }

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


async function techDebentureOffers(context: QueryContext, game: Document_<"games">, player: Document_<"players">)
{
    const rounds = [game.currentPeriod, game.currentPeriod - 1].filter((round) => round > 0);
    const trades = await Promise.all(rounds.map((round) => context.db.query("gameActions")
        .withIndex("by_game_period_turn", (q) => q.eq("gameId", game._id).eq("period", round)).collect()));
    const history = game.priceHistory ?? [];
    const quote = (round: number, key: number) => history.find((snapshot) => snapshot.period === round)
        ?.prices.find((price) => price.stockKey === key)?.value ?? 0;

    return player.holdings.filter((holding) => holding.quantity > 0).flatMap(({ stockKey, quantity }) =>
    {
        const current = game.prices.find((price) => price.stockKey === stockKey)?.value ?? 0;
        const drop = rounds.find((round) =>
        {
            const before = quote(round - 1, stockKey);
            const after = quote(round, stockKey);

            return before > current && after > 0 && Math.round(after * 1000) <= Math.round(before * 900);
        });
        if (drop === undefined)
        {
            return [];
        }

        const unitPrice = quote(drop - 1, stockKey);
        const boughtAfterDrop = trades.flat().some((event) => event.period >= drop && event.actorPlayerId === player._id
            && event.action.kind === "buy" && event.action.stockKey === stockKey);
        const unavailableReason = boughtAfterDrop ? "You bought shares in this company after the drop." : null;

        return [{ stockKey, quantity, unitPrice, amount: Math.round(quantity * unitPrice * 100) / 100,
            claimUntilPeriod: drop + 1, unavailableReason }];
    });
}
