import { money } from "../../game-contracts/src";
import type { Action, NpcObservation, ReasonCode } from "../../game-contracts/src";
import type { Estimate } from "./estimate";
export interface Preference {
    targets: ReadonlyMap<number, number>;
    reason: ReasonCode;
    neverSell?: number;
    urgentSales?: boolean;
    minCashFraction?: number;
    risk?: number;
}

export function wealth(observation: NpcObservation): number
{
    const self = observation.players.find((seat) => seat.id === observation.selfId)!;

    return (
        self.cash
        + self.holdings.reduce(
            (sum, item) =>
                sum
                + item.quantity
                * (observation.prices.find((price) => price.stockKey === item.stockKey)?.value
                  ?? 0),
            0,
        )
    );
}

export function ranked(
    observation: NpcObservation,
    estimates: readonly Estimate[],
    risk = 0,
): Estimate[]
{
    return estimates
        .filter(
            (item) =>
                (observation.prices.find((price) => price.stockKey === item.stockKey)?.value ?? 0)
                > 0,
        )
        .toSorted((a, b) =>
        {
            const value = (item: Estimate) =>
                (item.change - risk * item.spread)
                / observation.prices.find((price) => price.stockKey === item.stockKey)!.value;

            return value(b) - value(a) || a.stockKey - b.stockKey;
        });
}

export function allocation(
    observation: NpcObservation,
    estimates: readonly Estimate[],
    cap: number,
    invested: number,
    count = 2,
    risk = 0,
): Map<number, number>
{
    const positive = ranked(observation, estimates, risk)
        .filter((item) => item.change - risk * item.spread > 0)
        .slice(0, count);

    return new Map(
        positive.map((item) => [
            item.stockKey,
            Math.min(cap, invested / Math.max(1, positive.length)),
        ]),
    );
}

export function towardTargets(
    observation: NpcObservation,
    estimates: readonly Estimate[],
    preference: Preference,
): Action
{
    const self = observation.players.find((seat) => seat.id === observation.selfId)!;
    const total = wealth(observation);
    const targetSum = [...preference.targets.values()].reduce((sum, value) => sum + value, 0);
    const cashReserve = total * (preference.minCashFraction ?? Math.max(0, 1 - targetSum));
    let best: Action = { kind: "pass" };
    let bestScore = 0;
    for (const action of observation.legalActions)
    {
        if (
            action.kind === "pass"
            || (action.kind === "sell" && action.stockKey === preference.neverSell)
        )
        {
            continue;
        }

        const price = observation.prices.find((item) => item.stockKey === action.stockKey)!.value;
        if (
            action.kind === "buy"
            && money(self.cash - money(action.quantity * price)) < cashReserve - 0.005
        )
        {
            continue;
        }

        const held = self.holdings.find((item) => item.stockKey === action.stockKey)?.quantity ?? 0;
        const target = (total * (preference.targets.get(action.stockKey) ?? 0)) / price;
        const gap = target - held;
        if ((action.kind === "buy" ? gap : -gap) < action.quantity - 0.001)
        {
            continue;
        }

        const estimate = estimates.find((item) => item.stockKey === action.stockKey);
        const change = (estimate?.change ?? 0) - (preference.risk ?? 0) * (estimate?.spread ?? 0);
        const urgent = preference.urgentSales && action.kind === "sell" && change < 0;
        const benefit
            = action.quantity
              * (action.kind === "buy" ? Math.max(0.001, change) : Math.max(0.001, -change));
        const score = benefit + (urgent ? total * 100 : 0);
        if (score > bestScore)
        {
            best = action;
            bestScore = score;
        }
    }

    return best;
}
