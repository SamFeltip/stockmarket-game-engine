import { stockCatalog } from "../catalog";
import { cashStock, specialDeck, type DeckCard } from "../shared/chance-cards";
import { withRoleBonuses, type CompanyRole } from "../shared/company-roles";
import { packLengths, type Pack } from "../shared/packs";
import { startingCash } from "../shared/rules";
import { roundPrices } from "../shared/settlement";
import type { Document_, Id, QueryContext } from "./model";
import { techPrices, techStocks } from "./techMarket";

export function validPackLength(pack: Pack | undefined, lastPeriod: number)
{
    return packLengths(pack).includes(lastPeriod + 1);
}

export function packStartingCash(pack?: Pack)
{
    return pack === "tech" ? 3_000_000 : startingCash;
}

function franticRank(stockKey: number)
{
    return stockKey === 7 ? 6 : stockCatalog.find((stock) => stock.key === stockKey)?.variation ?? 1;
}

export function franticDeck(cards: DeckCard[])
{
    const natwest = cards.filter((card) => card.stockKey === 12);
    const trusthouse = natwest.length > 0 ? natwest.map((card) => ({
        ...card, id: `frantic:trusthouse:${card.id}`, stockKey: 7,
    })) : cards.filter((card) => card.stockKey === 7);
    const ordinary = cards.filter((card) => card.stockKey !== 7).concat(trusthouse).map((card) =>
    {
        if (!stockCatalog.some((stock) => stock.key === card.stockKey))
        {
            return card;
        }

        const value = Math.round(card.value * 1.45 ** franticRank(card.stockKey) * 100) / 100;
        const name = stockCatalog.find((stock) => stock.key === card.stockKey)?.name;

        return { ...card, value, description: `${name} Insight ${value.toFixed(2)}` };
    });

    return ordinary.concat(specialDeck("frantic"));
}

export async function packStocks(context: QueryContext, pack?: Pack, techStart?: number)
{
    if (pack === "tech")
    {
        if (techStart === undefined)
        {
            return [...techStocks, cashStock];
        }

        const quotes = techPrices(techStart, 0);

        return [...techStocks.map((stock, index) => ({ ...stock, startingValue: quotes[index].value })), cashStock];
    }

    const stocks = await context.db.query("stocks").collect();

    return pack === "frantic" ? stocks.map((stock) => stock.display ? {
        ...stock, startingValue: stock.startingValue * 3, variation: franticRank(stock.key),
    } : stock) : stocks;
}

export async function gameStocks(context: QueryContext, game: Document_<"games">)
{
    return packStocks(context, game.pack, game.techStart);
}

export async function gameStock(context: QueryContext, game: Document_<"games">, key: number)
{
    return game.pack === "tech" ? techStocks.find((stock) => stock.key === key)
        : context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", key)).unique();
}

export type SettlementCard = Document_<"playerInsights"> & { bonusRole?: CompanyRole; removedInsightId?: string };

export function settlementInsights(game: Document_<"games">, insights: Document_<"playerInsights">[],
    players: Document_<"players">[], stocks: Awaited<ReturnType<typeof gameStocks>>): SettlementCard[]
{
    const tech = game.pack === "tech";
    const effective = tech ? insights.filter((card) => !card.forecast) : withRoleBonuses(insights, players, stocks);
    const crash = game.pack === "crashing" && (game.currentPeriod + 1) % 3 === 0;
    if (!tech && !crash)
    {
        return effective;
    }

    const prices = tech ? techPrices(game.techStart!, game.currentPeriod + 1)
        : roundPrices(game.prices, effective, stocks, game.suspended);
    const events = prices.map(({ stockKey, value }) =>
    {
        const opening = game.prices.find((price) => price.stockKey === stockKey)!.value;

        return {
            _id: `market:${game.currentPeriod}:${stockKey}` as Id<"playerInsights">,
            _creationTime: 0, gameId: game._id, playerId: players[0]._id,
            period: game.currentPeriod, stockKey, resolved: true,
            value: tech ? Math.round((value - opening) * 100) / 100 : -(Math.round(value * 30) / 100),
            description: tech ? "Historical market close" : "Market crash · 30% drop",
        };
    });

    return effective.concat(events);
}
