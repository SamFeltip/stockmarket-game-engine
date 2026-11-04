import { settledPrice } from "../../game-contracts/src";
import type { NpcObservation } from "../../game-contracts/src";
import { random } from "./random";
import { sampleCount } from "./difficulty";
export interface Estimate {
    stockKey: number;
    change: number;
    spread: number;
    outcomes: readonly number[];
}

export function ownSignal(observation: NpcObservation, key: number): number
{
    return observation.ownInsights
        .filter((card) => card.stockKey === key)
        .reduce((sum, card) => sum + card.value, 0);
}

export function estimate(observation: NpcObservation, hard: boolean, seed: string): Estimate[]
{
    const ownIds = new Set(observation.ownInsights.map((card) => card.id));
    const pool = observation.catalog.filter((card) => !ownIds.has(card.id));
    const unseen = 10 * (observation.players.length - 1);
    if (hard && unseen > pool.length)
    {
        throw new Error("Catalog cannot supply unseen hands");
    }

    const next = random(`${seed}:outcomes`);
    const samples = Array.from({ length: hard ? sampleCount : 1 }, () =>
    {
        const sums = new Map<number, number>();
        if (hard)
        {
            // Partial Fisher–Yates draws from the entire remaining multiset, without replacement.
            const cards = [...pool];
            for (let index = 0; index < unseen; index++)
            {
                const other = index + Math.floor(next() * (cards.length - index));

                [cards[index], cards[other]] = [cards[other], cards[index]];
                const card = cards[index];

                sums.set(card.stockKey, (sums.get(card.stockKey) ?? 0) + card.value);
            }
        }

        return sums;
    });

    return observation.prices.map((price) =>
    {
        const signal = ownSignal(observation, price.stockKey);
        const outcomes = samples.map((sums) =>
            settledPrice(price.value, signal + (sums.get(price.stockKey) ?? 0)),
        );
        const mean = outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length;
        const spread = Math.sqrt(
            outcomes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / outcomes.length,
        );

        return {
            stockKey: price.stockKey,
            change: hard ? mean - price.value : signal,
            spread,
            outcomes,
        };
    });
}
