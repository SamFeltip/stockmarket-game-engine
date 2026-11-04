import type { Action, NpcMemory, NpcObservation, NpcProfile } from "../../../game-contracts/src";
import type { Estimate } from "../estimate";
import { smallTrade } from "../candidates";
import { behaviour, netTrades } from "../memory";
import { allocation, wealth } from "../targets";
import type { Preference } from "../targets";
export function caseyEasy(observation: NpcObservation, next: () => number): Action
{
    const latest = observation.events.findLast(
        (event) =>
            event.period === observation.period
            && event.actorPlayerId !== observation.selfId
            && event.action.kind !== "pass",
    );
    if (latest && latest.action.kind !== "pass")
    {
        return smallTrade(
            observation,
            latest.action.kind,
            latest.action.stockKey,
            Math.min(2000, latest.action.quantity),
        );
    }

    const choices = observation.prices
        .map((price) => smallTrade(observation, "buy", price.stockKey))
        .filter((action) => action.kind !== "pass");

    return choices[Math.floor(next() * choices.length)] ?? { kind: "pass" };
}

export function casey(
    observation: NpcObservation,
    profile: NpcProfile,
    estimates: readonly Estimate[],
    memory: NpcMemory,
): Preference
{
    const hard = profile.difficulty === "hard";
    const signals = estimates.map((item) => ({
        ...item,
        change: hard
            ? 0.6 * item.change + 0.4 * behaviour(observation, memory, item.stockKey)
            : (item.change < 0
                ? item.change
                : Math.sign(netTrades(observation, memory.leaderId ?? "", item.stockKey))),
    }));

    const targets = allocation(observation, signals, hard ? 0.45 : 0.4, hard ? 0.9 : 0.8, 3);
    if (!hard)
    {
        const self = observation.players.find((seat) => seat.id === observation.selfId)!;
        for (const holding of self.holdings)
        {
            const net = netTrades(observation, memory.leaderId ?? "", holding.stockKey);
            const signal
                = estimates.find((item) => item.stockKey === holding.stockKey)?.change ?? 0;
            if (net === 0 || (net < 0 && signal > 0))
            {
                const price
                    = observation.prices.find((item) => item.stockKey === holding.stockKey)?.value
                      ?? 0;

                targets.set(
                    holding.stockKey,
                    Math.min(0.4, (holding.quantity * price) / Math.max(1, wealth(observation))),
                );
            }
        }
    }

    return { targets, reason: "copy", minCashFraction: hard ? 0.1 : 0.2 };
}
