import type { Action, NpcObservation } from "../../game-contracts/src";
import { difficulty } from "./difficulty";
import type { Estimate } from "./estimate";

export function franticTrade(observation: NpcObservation, estimates: readonly Estimate[],
    level: keyof typeof difficulty): Action | undefined
{
    const signals = new Map(estimates.map(({ stockKey, change, spread }) => [stockKey, { change, spread }]));
    const rivals = new Map<number, number>();
    for (const player of observation.players)
    {
        if (player.id !== observation.selfId)
        {
            for (const { stockKey, quantity } of player.holdings)
            {
                rivals.set(stockKey, (rivals.get(stockKey) ?? 0) + quantity);
            }
        }
    }

    let best: Action | undefined;
    let bestScore = 0;
    for (const action of observation.legalActions)
    {
        if (action.kind === "pass")
        {
            continue;
        }

        const signal = signals.get(action.stockKey);
        if (!signal)
        {
            continue;
        }

        // Take larger positions on strong signals; give exiting a rival-heavy loser extra urgency.
        const edge = (action.kind === "buy" ? signal.change : -signal.change) - difficulty[level].risk * signal.spread;
        const rivalPressure = action.kind === "sell" ? Math.min(1, (rivals.get(action.stockKey) ?? 0) / action.quantity) : 0;
        const score = action.quantity * edge * (1 + rivalPressure);
        if (score > bestScore)
        {
            best = action;
            bestScore = score;
        }
    }

    return best;
}
