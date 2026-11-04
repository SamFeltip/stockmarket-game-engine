import { legalActions, transition } from "../../game-contracts/src";
import type { Action, Market, NpcObservation } from "../../game-contracts/src";
import type { Estimate } from "./estimate";
import { planLimit } from "./difficulty";
import { wealth } from "./targets";

interface Plan {
    market: Market;
    actions: readonly Action[];
    score: number;
}

export function plan(observation: NpcObservation, estimates: readonly Estimate[]): Action
{
    const initialWealth = wealth(observation);
    const self = observation.players.find((seat) => seat.id === observation.selfId)!;
    const final = observation.period === observation.finalPeriod;
    const risk = final ? (self.ranking === 1 ? 0.1 : 0.015) : 0.15;

    const scenarioCount = estimates[0]?.outcomes.length ?? 1;
    const samplePrices = new Map(
        estimates.map((estimate) =>
        {
            const price
                = observation.prices.find((item) => item.stockKey === estimate.stockKey)?.value ?? 0;
            const mean = estimate.outcomes.reduce((sum, value) => sum + value, 0) / scenarioCount;

            return [
                estimate.stockKey,
                estimate.outcomes.map((value) =>
                    Math.max(0, value + estimate.change - (mean - price)),
                ),
            ];
        }),
    );

    const evaluate = (market: Market) =>
    {
        const seat = market.players.find((item) => item.id === market.selfId)!;
        let sum = 0;
        let downside = 0;
        for (let index = 0; index < scenarioCount; index++)
        {
            let value = seat.cash;
            for (const holding of seat.holdings)
            {
                value += holding.quantity * (samplePrices.get(holding.stockKey)?.[index] ?? 0);
            }

            sum += value;
            downside += Math.min(0, value - initialWealth) ** 2;
        }

        return sum / scenarioCount - risk * Math.sqrt(downside / scenarioCount);
    };

    let beam: Plan[] = [{ market: observation, actions: [], score: evaluate(observation) }];
    let best = beam[0];
    for (let depth = 0; depth < observation.actionsRemaining; depth++)
    {
        const expanded: Plan[] = [];
        const budget = Math.floor(planLimit / observation.actionsRemaining);
        for (const parent of beam)
        {
            const legal = legalActions(parent.market);
            const candidates: Action[] = [{ kind: "pass" }];
            for (const price of observation.prices.filter((item) => item.value > 0))
            {
                const holding
                    = parent.market.players
                        .find((item) => item.id === observation.selfId)!
                        .holdings.find((item) => item.stockKey === price.stockKey)?.quantity ?? 0;
                const estimate = estimates.find((item) => item.stockKey === price.stockKey)!;
                const positiveFraction
                    = estimate.outcomes.filter((value) => value > price.value).length
                      / estimate.outcomes.length;
                const cap = final && positiveFraction >= 0.9 ? 0.9 : 0.65;
                for (const kind of ["buy", "sell"] as const)
                {
                    const options = legal.filter(
                        (action) =>
                            action.kind === kind
                            && action.stockKey === price.stockKey
                            && (kind === "sell"
                              || (holding + action.quantity) * price.value
                              <= initialWealth * cap + 0.01),
                    );
                    if (options.length > 0)
                    {
                        candidates.push(options.at(-1)!, options[Math.floor(options.length / 2)]);
                    }
                }
            }

            // Divide the 64-plan budget across depths and parents; common scenarios make comparisons fair.
            const options = candidates
                .map((action) => ({ action, market: transition(parent.market, action) }))
                .map((item) => ({ ...item, score: evaluate(item.market) }))
                .toSorted((a, b) => b.score - a.score)
                .slice(0, Math.max(1, Math.floor(budget / beam.length)));
            for (const { action, market, score } of options)
            {
                const actions = [...parent.actions, action];
                const candidate = {
                    market,
                    actions,
                    score: score - actions.filter((item) => item.kind !== "pass").length * 0.001,
                };

                expanded.push(candidate);

                if (candidate.score > best.score + 0.001)
                {
                    best = candidate;
                }
            }
        }

        beam = expanded.toSorted((a, b) => b.score - a.score).slice(0, 4);
    }

    return best.actions[0] ?? { kind: "pass" };
}
