import type { Action, NpcObservation, NpcProfile } from "../../../game-contracts/src";
import type { Estimate } from "../estimate";
import { smallTrade } from "../candidates";
import { allocation } from "../targets";
import type { Preference } from "../targets";
export function adaEasy(observation: NpcObservation): Action
{
    const negatives = observation.ownInsights
        .filter((card) => card.value < 0)
        .toSorted((a, b) => a.value - b.value);
    for (const card of negatives)
    {
        const action = smallTrade(observation, "sell", card.stockKey);
        if (action.kind !== "pass")
        {
            return action;
        }
    }

    for (const card of observation.ownInsights
        .filter((card) => card.value > 0)
        .toSorted((a, b) => b.value - a.value))
    {
        const action = smallTrade(observation, "buy", card.stockKey);
        if (action.kind !== "pass")
        {
            return action;
        }
    }

    return { kind: "pass" };
}

export function ada(
    observation: NpcObservation,
    profile: NpcProfile,
    estimates: readonly Estimate[],
): Preference
{
    const hard = profile.difficulty === "hard";

    return {
        targets: allocation(
            observation,
            estimates,
            hard ? 0.5 : 0.4,
            hard ? 0.9 : 0.8,
            2,
            hard ? 0.12 : 0,
        ),
        risk: hard ? 0.12 : 0,
        reason: "cards",
        urgentSales: !hard,
    };
}
