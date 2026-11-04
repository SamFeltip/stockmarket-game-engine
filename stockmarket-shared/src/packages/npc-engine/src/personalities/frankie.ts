import type { NpcObservation, NpcProfile } from "../../../game-contracts/src";
import type { Estimate } from "../estimate";
import { allocation } from "../targets";
import type { Preference } from "../targets";
export function frankie(
    observation: NpcObservation,
    profile: NpcProfile,
    estimates: readonly Estimate[],
): Preference
{
    const favourite = observation.favouriteStockKey;
    const negative = (estimates.find((item) => item.stockKey === favourite)?.change ?? 0) < 0;
    if (profile.difficulty === "easy")
    {
        return { targets: new Map([[favourite, 0.85]]), neverSell: favourite, reason: "loyalty" };
    }

    const hard = profile.difficulty === "hard";
    const targets = allocation(
        observation,
        estimates.filter((item) => item.stockKey !== favourite),
        0.25,
        hard ? 0.5 : 0.25,
        hard ? 2 : 1,
        hard ? 0.12 : 0,
    );

    targets.set(favourite, hard ? (negative ? 0.15 : 0.4) : (negative ? 0.3 : 0.6));

    return { targets, reason: "loyalty", urgentSales: !hard, risk: hard ? 0.12 : 0 };
}
