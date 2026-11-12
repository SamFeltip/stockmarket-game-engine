/** Resolve chance cards in the current period's opening-seat order, one physical card at a time. */
export function pendingSuspensions<T extends { _id: string; playerId: string;
    period?: number; chanceKind?: string; used?: boolean; resolved: boolean }>(
    period: number, players: { _id: string }[], insights: T[],
): T[]
{
    const order = players.map((_, index) => players[(period + index) % players.length]._id);

    return insights.filter((card) => card.chanceKind === "hold" && !card.used && !card.resolved
      && order.includes(card.playerId)
      && (card.period === undefined || card.period === period))
        .toSorted((a, b) => order.indexOf(a.playerId) - order.indexOf(b.playerId) || a._id.localeCompare(b._id));
}

type Stockholder = { holdings: readonly { stockKey: number; quantity: number }[] };

export function sharesHeld(player: Stockholder | undefined, stockKey: number)
{
    return player?.holdings.find((holding) => holding.stockKey === stockKey)?.quantity ?? 0;
}

export function stockholders<T extends Stockholder>(players: readonly T[], stockKey: number)
{
    return players.filter((player) => sharesHeld(player, stockKey) > 0);
}

export interface TargetedSuspension {
    stockKey: number;
    playerIds: readonly string[];
}

export function hasTargetedSuspension(suspensions: readonly TargetedSuspension[] | undefined, stockKey: number, playerId: string)
{
    return suspensions?.some((item) => item.stockKey === stockKey && item.playerIds.includes(playerId)) ?? false;
}

export interface TradingSuspension<PlayerId extends string = string> {
    stockKey: number;
    value: number;
    excludedPlayerIds: PlayerId[];
}

interface Quote { stockKey: number; value: number }
interface TradingMarket { prices: Quote[]; tradingSuspensions?: readonly TradingSuspension[] }

/** Only shareholders who were unticked at settlement are exempt. Later purchases don't change eligibility. */
export function nextTradingSuspensions<PlayerId extends string>(game: {
    prices: Quote[]; targetedSuspensions?: readonly TargetedSuspension[]; currentPeriod: number; periodCount: number;
}, players: readonly (Stockholder & { _id: PlayerId })[])
{
    if (game.currentPeriod >= game.periodCount)
    {
        return [];
    }

    return (game.targetedSuspensions ?? []).flatMap(({ stockKey, playerIds }) =>
    {
        const quote = game.prices.find((price) => price.stockKey === stockKey);
        const excludedPlayerIds = stockholders(players, stockKey).filter((player) => !playerIds.includes(player._id))
            .map((player) => player._id);

        return quote ? [{ ...quote, excludedPlayerIds }] : [];
    });
}

function suspendedQuote(game: TradingMarket, stockKey: number, playerId: string)
{
    return game.tradingSuspensions?.find((item) => item.stockKey === stockKey
        && !item.excludedPlayerIds.includes(playerId))?.value;
}

export function tradingQuote(game: TradingMarket, stockKey: number, playerId: string)
{
    return suspendedQuote(game, stockKey, playerId) ?? game.prices.find((price) => price.stockKey === stockKey)?.value;
}

export function tradingPrices(game: TradingMarket, playerId: string)
{
    return game.tradingSuspensions?.length ? game.prices.map((quote) =>
        ({ ...quote, value: suspendedQuote(game, quote.stockKey, playerId) ?? quote.value })) : game.prices;
}
