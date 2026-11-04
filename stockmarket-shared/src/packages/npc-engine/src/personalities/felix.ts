import type { Decision, NpcMemory, NpcObservation, NpcProfile } from "../../../game-contracts/src";
import type { Estimate } from "../estimate";
import { smallTrade } from "../candidates";
import { allocation, ranked, towardTargets, wealth } from "../targets";
export function felix(
    observation: NpcObservation,
    profile: NpcProfile,
    estimates: readonly Estimate[],
    memory: NpcMemory,
    next: () => number,
): Decision
{
    const bait = memory.bait?.period === observation.period ? memory.bait : undefined;
    if (bait)
    {
        const action = smallTrade(observation, "sell", bait.stockKey, bait.quantity);

        return { action, nextMemory: { ...memory, bait: undefined }, reason: "unwind" };
    }

    const easy = profile.difficulty === "easy";
    const hard = profile.difficulty === "hard";
    const self = observation.players.find((seat) => seat.id === observation.selfId)!;
    const urgent = self.holdings.filter(
        (holding) =>
            holding.quantity > 0
            && (estimates.find((item) => item.stockKey === holding.stockKey)?.change ?? 0) < 0,
    ).length;
    const susceptible = memory.followers.some(
        (item) => item.responses >= 2 && observation.remainingSeatOrder.includes(item.playerId),
    );
    const mayBluff
        = observation.actionsRemaining === 3
          && (easy
            || (observation.period !== observation.finalPeriod
              && urgent < (hard ? 1 : 2)
              && (!hard || susceptible)));
    if (mayBluff)
    {
        const budget = wealth(observation) * (easy ? 1 : (hard ? 0.03 : 0.05));
        const choices = estimates
            .filter((item) => item.change < 0)
            .map((item) => smallTrade(observation, "buy", item.stockKey, 1000))
            .filter((action) =>
            {
                if (action.kind !== "buy")
                {
                    return false;
                }

                const cost
                    = action.quantity
                      * observation.prices.find((price) => price.stockKey === action.stockKey)!.value;

                return cost <= budget && (easy || self.cash - cost >= wealth(observation) * 0.1);
            });
        const action = choices[Math.floor(next() * choices.length)];
        if (action?.kind === "buy")
        {
            return {
                action,
                nextMemory: {
                    ...memory,
                    bait: {
                        period: observation.period,
                        turn: observation.turn,
                        stockKey: action.stockKey,
                        quantity: action.quantity,
                    },
                },
                reason: "bluff",
            };
        }
    }

    if (easy)
    {
        const positive = ranked(observation, estimates).find((item) => item.change > 0);
        const buy = positive
            ? smallTrade(observation, "buy", positive.stockKey)
            : { kind: "pass" as const };
        if (buy.kind !== "pass")
        {
            return { action: buy, nextMemory: memory, reason: "cards" };
        }

        for (const item of estimates
            .filter((entry) => entry.change < 0)
            .toSorted((a, b) => a.change - b.change))
        {
            const sale = smallTrade(observation, "sell", item.stockKey);
            if (sale.kind !== "pass")
            {
                return { action: sale, nextMemory: memory, reason: "cards" };
            }
        }

        return { action: { kind: "pass" }, nextMemory: memory, reason: "retain-cash" };
    }

    const action = towardTargets(observation, estimates, {
        targets: allocation(observation, estimates, hard ? 0.5 : 0.45, 0.9, 2),
        reason: "cards",
        urgentSales: true,
        risk: hard ? 0.12 : 0,
    });

    return { action, nextMemory: memory, reason: action.kind === "pass" ? "retain-cash" : "cards" };
}
