import type { NpcMemory, NpcObservation, NpcProfile } from "../../../game-contracts/src";
import type { Estimate } from "../estimate";
import { behaviour } from "../memory";
import { allocation } from "../targets";
import type { Preference } from "../targets";
export function morganEstimates(
    observation: NpcObservation,
    profile: NpcProfile,
    estimates: readonly Estimate[],
    memory: NpcMemory,
): Estimate[]
{
    return estimates.map((item) => ({
        ...item,
        change:
            profile.difficulty === "easy"
                ? item.change
                : item.change * 0.8 + 0.2 * behaviour(observation, memory, item.stockKey, true),
    }));
}

export function morgan(
    observation: NpcObservation,
    profile: NpcProfile,
    estimates: readonly Estimate[],
): Preference
{
    const easy = profile.difficulty === "easy";

    return {
        targets: allocation(observation, estimates, easy ? 0.25 : 0.45, easy ? 0.5 : 0.8),
        reason: "targets",
        urgentSales: easy,
    };
}
