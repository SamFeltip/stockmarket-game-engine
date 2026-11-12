import { stockCatalog } from "../catalog";
import { cashStock, specialDeck, type DeckCard } from "../shared/chance-cards";
import { withRoleBonuses, type CompanyRole } from "../shared/company-roles";
import { legacyTechRounds, packLengths, type Pack } from "../shared/packs";
import { startingCash } from "../shared/rules";
import { roundPrices } from "../shared/settlement";
import type { Document_, Id, QueryContext } from "./model";
import { techForecastDescription, techPeriodCloses, techPrices, techStocks } from "./techMarket";

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

export async function displayGameStocks(context: QueryContext, game?: Pick<Document_<"games">, "pack" | "techStart">)
{
    const stocks = await packStocks(context, game?.pack, game?.techStart);
    const scored = stocks.map((stock) =>
    {
        const classicScore = stockCatalog.find((item) => item.key === stock.key)?.variation;

        return game?.pack === "frantic" || classicScore === undefined ? stock : { ...stock, variation: classicScore };
    });

    return scored.sort((a, b) => Number(b.display) - Number(a.display) || a.variation - b.variation || a.key - b.key);
}

export async function gameStock(context: QueryContext, game: Document_<"games">, key: number)
{
    return game.pack === "tech" ? techStocks.find((stock) => stock.key === key)
        : context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", key)).unique();
}

export type SettlementCard = Document_<"playerInsights"> & {
    bonusRole?: CompanyRole; removedInsightId?: string; marketSteps?: number[];
};

export function revealInsights(game: Document_<"games">, insights: Document_<"playerInsights">[],
    players: Document_<"players">[], stocks: Awaited<ReturnType<typeof gameStocks>>): SettlementCard[]
{
    const effective = settlementInsights(game, insights, players, stocks);

    return game.pack === "tech" && !legacyTechRounds(game)
        ? insights.filter((card) => card.forecast)
            .map((card) => ({ ...card, description: techForecastDescription(game.techStart, card) })).concat(effective)
        : effective;
}

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

    function marketCard(stockKey: number, value: number, description: string, date?: string): SettlementCard
    {
        const id = `market:${game.currentPeriod}:${stockKey}${date ? `:${date}` : ""}`;

        return { _id: id as Id<"playerInsights">, _creationTime: 0, gameId: game._id, playerId: players[0]._id,
            period: game.currentPeriod, stockKey, resolved: true, value, description };
    }

    if (tech)
    {
        const closes = techPeriodCloses(game);
        const previous = new Map(game.prices.map(({ stockKey, value }) => [stockKey, value]));
        if (!legacyTechRounds(game))
        {
            const last = closes.at(-1)!;
            const results = last.prices.map(({ stockKey, value }, index) => ({
                ...marketCard(stockKey, Math.round((value - previous.get(stockKey)!) * 100) / 100,
                    `Historical close · ${last.label}`, last.date),
                marketSteps: closes.map(({ prices }) => prices[index].value),
            }));

            return effective.concat(results);
        }

        const events = closes.flatMap(({ date, label, prices }) =>
            prices.map(({ stockKey, value }) =>
            {
                const change = Math.round((value - previous.get(stockKey)!) * 100) / 100;

                previous.set(stockKey, value);

                return marketCard(stockKey, change, `Historical close · ${label}`, date);
            }));

        return effective.concat(events);
    }

    const prices = roundPrices(game.prices, effective, stocks, game.suspended);

    return effective.concat(prices.map(({ stockKey, value }) =>
        marketCard(stockKey, -(Math.round(value * 30) / 100), "Market crash · 30% drop")));
}
