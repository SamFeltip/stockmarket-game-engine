import { floorTradeQuantity, validTradeQuantity } from "./rules";
import type { Pack } from "./packs";

/** Retail Rights Issue: one new share per two held, at £1 each. */
export const rightsIssuePrice = 1;

export const rightsEntitlement = (held: number, pack?: Pack) => floorTradeQuantity(pack === "frantic" ? held : held / 2);

export function rightsMaximum(held: number, pack?: Pack, isActor = false)
{
    return pack === "frantic" && isActor ? Math.max(1000, rightsEntitlement(held, pack)) : rightsEntitlement(held, pack);
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

export function rightsPurchaseError(quantity: number, maximum: number, cash: number, pack?: Pack)
{
    if (!Number.isSafeInteger(quantity) || quantity < 0)
    {
        return "Enter a whole number of shares.";
    }

    if (quantity > maximum)
    {
        return pack === "frantic" ? "Choose a quantity within your offer."
            : "You may only buy one extra share for every two you owned when the Rights Issue started.";
    }

    if (quantity !== 0 && !validTradeQuantity(quantity))
    {
        return "Enter a positive number of shares in steps of 1,000.";
    }

    return quantity * rightsIssuePrice > cash ? "You don't have enough cash. Try fewer shares." : "";
}

export { sharesAvailable as rightsAvailable } from "./rules";
