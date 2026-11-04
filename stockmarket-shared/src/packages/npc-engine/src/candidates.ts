import type { Action, NpcAction, NpcObservation } from "../../game-contracts/src";
export function smallTrade(
    observation: NpcObservation,
    kind: "buy" | "sell",
    stockKey: number,
    limit = 2000,
): Action
{
    return (
        observation.legalActions
            .filter(
                (action) =>
                    action.kind === kind
                    && action.stockKey === stockKey
                    && action.quantity <= limit,
            )
            .toSorted(
                (a, b) =>
                    (b.kind === "pass" ? 0 : b.quantity) - (a.kind === "pass" ? 0 : a.quantity),
            )[0] ?? { kind: "pass" }
    );
}

export function isLegalProposal<T extends NpcAction>(action: unknown, legal: readonly T[]): action is T
{
    if (!action || typeof action !== "object" || !("kind" in action))
    {
        return false;
    }

    return legal.some((item) =>
    {
        if (item.kind !== action.kind)
        {
            return false;
        }

        if (item.kind === "pass")
        {
            return true;
        }

        if (item.kind === "buy" || item.kind === "sell")
        {
            return "stockKey" in action && "quantity" in action
              && item.stockKey === action.stockKey && item.quantity === action.quantity;
        }

        return "insightId" in item && "insightId" in action && item.insightId === action.insightId
          && (item.kind === "government-loan" || ("stockKey" in action && item.stockKey === action.stockKey));
    });
}
