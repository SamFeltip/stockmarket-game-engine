export const startingCash = 60_000;

export const sharesPerCompany = 200_000;

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

export const maximumPlayers = 6;
