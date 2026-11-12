export const startingCash = 60_000;

export const sharesPerCompany = 200_000;

export function sharesAvailable(players: readonly { holdings: readonly { stockKey: number; quantity: number }[] }[],
    stockKey: number)
{
    return Math.max(0, sharesPerCompany - players.reduce((sum, player) => sum
      + (player.holdings.find((holding) => holding.stockKey === stockKey)?.quantity ?? 0), 0));
}

export const gameLengths = [6, 7, 8, 9, 10];

export const minimumPlayers = 4;

export function validGameLength(lastPeriod: number)
{
    return gameLengths.includes(lastPeriod + 1);
}

export function validTradeQuantity(quantity: number)
{
    const size = Math.abs(quantity);

    return Number.isSafeInteger(quantity) && size > 0
      && size % 1000 === 0;
}

export function floorTradeQuantity(quantity: number)
{
    if (!Number.isFinite(quantity) || quantity <= 0)
    {
        return 0;
    }

    return Math.floor(quantity / 1000) * 1000;
}

export function roundMoney(amount: number)
{
    return Math.round(amount * 100) / 100;
}

export function sharesForCash(cash: number, price: number)
{
    if (!Number.isFinite(cash) || !Number.isFinite(price) || cash <= 0 || price <= 0)
    {
        return 0;
    }

    const quantity = floorTradeQuantity(cash / price);
    const nextLot = quantity + 1000;

    return roundMoney(nextLot * price) <= cash ? nextLot : quantity;
}

export const maximumPlayers = 6;

export function inStockOrder<T extends { stockKey: number }>(items: readonly T[], stocks: readonly { key: number }[])
{
    const position = new Map(stocks.map(({ key }, index) => [key, index]));

    return [...items].sort((a, b) =>
        (position.get(a.stockKey) ?? stocks.length) - (position.get(b.stockKey) ?? stocks.length));
}
