import { stockCatalog } from "../catalog";
import { cashStock } from "../shared/chance-cards";
import { withRoleBonuses, type CompanyRole } from "../shared/company-roles";
import { legacyTechRounds, packLengths, rulesForPack, type Pack } from "../shared/packs";
import type { Document_, Id, QueryContext } from "./model";
import { chooseTechStart, techForecastDescription, techPeriodCloses, techPrices, techStocks } from "./techMarket";

export function validPackLength(pack: Pack | undefined, lastPeriod: number)
{
    return packLengths(pack).includes(lastPeriod + 1);
}

export function packStartingCash(pack?: Pack)
{
    return rulesForPack(pack).openingCash;
}

export function franticRank(stockKey: number)
{
    return stockKey === 7 ? 6 : stockCatalog.find((stock) => stock.key === stockKey)?.variation ?? 1;
}

function catalogStocks(context: QueryContext)
{
    return context.db.query("stocks").collect();
}

async function franticStocks(context: QueryContext)
{
    const stocks = await catalogStocks(context);

    return stocks.map((stock) => stock.display ? {
        ...stock, startingValue: stock.startingValue * 3, variation: franticRank(stock.key),
    } : stock);
}

function historicalStocks(_context: QueryContext, techStart?: number)
{
    if (techStart === undefined)
    {
        return [...techStocks, cashStock];
    }

    const quotes = techPrices(techStart, 0);

    return [...techStocks.map((stock, index) => ({ ...stock, startingValue: quotes[index].value })), cashStock];
}

function historicalOpening(random: number, periods: number)
{
    const techStart = chooseTechStart(random, periods);
    const prices = techPrices(techStart, 0);

    return { techStart, periodCount: periods - 1, prices, priceHistory: [{ period: 0, prices }] };
}

type Stock = Pick<Document_<"stocks">, "key" | "name" | "display" | "variation" | "startingValue"
    | "imagePath" | "secondaryImagePath">;

interface PackMarket {
    stocks(context: QueryContext, techStart?: number): Stock[] | Promise<Stock[]>;
    settle(input: SettlementInput): SettlementCard[];
    opening?: typeof historicalOpening;
    useCatalogScores?: boolean;
}

const catalogMarket: PackMarket = { stocks: catalogStocks, useCatalogScores: true, settle: companyRoleSettlement };
const packMarkets: Record<Pack, PackMarket> = {
    classic: catalogMarket,
    frantic: { stocks: franticStocks, settle: companyRoleSettlement },
    tech: { stocks: historicalStocks, opening: historicalOpening, settle: historicalSettlement },
};

export function packStocks(context: QueryContext, pack: Pack = "classic", techStart?: number)
{
    return packMarkets[pack].stocks(context, techStart);
}

export function launchMarket(pack: Pack | undefined, random: () => number, periods: number)
{
    const opening = packMarkets[pack ?? "classic"].opening;

    return opening?.(random(), periods);
}

export async function gameStocks(context: QueryContext, game: Document_<"games">)
{
    return packStocks(context, game.pack, game.techStart);
}

export async function displayGameStocks(context: QueryContext, game?: Pick<Document_<"games">, "pack" | "techStart">)
{
    const stocks = await packStocks(context, game?.pack, game?.techStart);
    const market = packMarkets[game?.pack ?? "classic"];
    const scored = stocks.map((stock) =>
    {
        const classicScore = stockCatalog.find((item) => item.key === stock.key)?.variation;

        return market.useCatalogScores && classicScore !== undefined ? { ...stock, variation: classicScore } : stock;
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

type SettlementInput = {
    game: Document_<"games">;
    insights: Document_<"playerInsights">[];
    players: Document_<"players">[];
    stocks: Stock[];
};

function companyRoleSettlement({ insights, players, stocks }: SettlementInput): SettlementCard[]
{
    return withRoleBonuses(insights, players, stocks);
}

function marketCard({ game, players }: SettlementInput, stockKey: number, value: number,
    description: string, date?: string): SettlementCard
{
    const id = `market:${game.currentPeriod}:${stockKey}${date ? `:${date}` : ""}`;

    return { _id: id as Id<"playerInsights">, _creationTime: 0, gameId: game._id, playerId: players[0]._id,
        period: game.currentPeriod, stockKey, resolved: true, value, description };
}

function historicalSettlement(input: SettlementInput): SettlementCard[]
{
    const { game, insights } = input;
    const effective = insights.filter((card) => !card.forecast);
    const closes = techPeriodCloses(game);
    const previous = new Map(game.prices.map(({ stockKey, value }) => [stockKey, value]));
    if (!legacyTechRounds(game))
    {
        const last = closes.at(-1)!;
        const results = last.prices.map(({ stockKey, value }, index) => ({
            ...marketCard(input, stockKey, Math.round((value - previous.get(stockKey)!) * 100) / 100,
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

            return marketCard(input, stockKey, change, `Historical close · ${label}`, date);
        }));

    return effective.concat(events);
}

export function settlementInsights(game: Document_<"games">, insights: Document_<"playerInsights">[],
    players: Document_<"players">[], stocks: Stock[]): SettlementCard[]
{
    return packMarkets[game.pack ?? "classic"].settle({ game, insights, players, stocks });
}
