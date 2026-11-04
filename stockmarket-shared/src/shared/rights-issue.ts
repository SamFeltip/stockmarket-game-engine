import { sharesPerCompany } from "./rules";
/** Retail Rights Issue: one new share per two held, at £1 each. */
export const rightsIssuePrice = 1;

export const rightsEntitlement = (held: number) => Math.floor(Math.max(0, held) / 2);

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

export function rightsPurchaseError(quantity: number, maximum: number, cash: number)
{
    if (!Number.isSafeInteger(quantity) || quantity < 0)
    {
        return "Enter a whole number of shares.";
    }

    if (quantity > maximum)
    {
        return "You may only buy one extra share for every two you owned when the Rights Issue started.";
    }

    return quantity * rightsIssuePrice > cash ? "You don't have enough cash. Try fewer shares." : "";
}

/** Preserve the game's existing bank inventory where the retail review is silent. */
export function rightsAvailable(players: { holdings: { stockKey: number; quantity: number }[] }[], stockKey: number)
{
    return Math.max(0, sharesPerCompany - players.reduce((sum, player) => sum
      + (player.holdings.find((holding) => holding.stockKey === stockKey)?.quantity ?? 0), 0));
}
