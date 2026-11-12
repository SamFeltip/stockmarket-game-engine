import { floorTradeQuantity, roundMoney, sharesForCash, validTradeQuantity } from "./rules";
import { rulesForPack, type Pack } from "./packs";

/** Retail Rights Issue: one new share per two held, at £1 each. */
export const rightsIssuePrice = 1;

export function rightsPriceFor(pack: Pack | undefined, marketPrice: number)
{
    const { marketPricePercent } = rulesForPack(pack).rights;

    return marketPricePercent === undefined ? rightsIssuePrice
        : Math.max(0.01, Math.round(marketPrice * marketPricePercent) / 100);
}

export const rightsEntitlement = (held: number, pack?: Pack) =>
    floorTradeQuantity(held * rulesForPack(pack).rights.sharesPerHolding);

export function maxRightsPurchase(maximum: number, cash: number, available: number, price: number)
{
    return floorTradeQuantity(Math.min(maximum, sharesForCash(cash, price), available));
}

export interface RightsIssue {
    insightId: string;
    stockKey: number;
    actorPlayerId: string;
    period: number;
    turn: number;
    index: number;
    completed?: boolean;
    offers: { playerId: string; held: number; maximum: number; purchased?: number }[];
}

export function rightsIssueOrder<T extends { _id: string }>(players: T[], actorId: string)
{
    const start = players.findIndex((player) => player._id === actorId);

    return [...players.slice(start), ...players.slice(0, start)];
}

export function rightsPurchaseError(quantity: number, maximum: number, cash: number, pack?: Pack, price = rightsIssuePrice)
{
    if (!Number.isSafeInteger(quantity) || quantity < 0)
    {
        return "Enter a whole number of shares.";
    }

    if (quantity > maximum)
    {
        const { sharesPerHolding } = rulesForPack(pack).rights;

        return sharesPerHolding === 0.5
            ? "You may only buy one extra share for every two you owned when the Rights Issue started."
            : `You may only buy up to ${sharesPerHolding} extra shares per share you owned when the Rights Issue started.`;
    }

    if (quantity !== 0 && !validTradeQuantity(quantity))
    {
        return "Enter a positive number of shares in steps of 1,000.";
    }

    if (quantity > 0 && (!Number.isFinite(price) || price <= 0))
    {
        return "Choose a tradable stock";
    }

    return quantity > 0 && (!Number.isFinite(cash) || roundMoney(quantity * price) > cash)
        ? "You don't have enough cash. Try fewer shares." : "";
}

export { sharesAvailable as rightsAvailable } from "./rules";
