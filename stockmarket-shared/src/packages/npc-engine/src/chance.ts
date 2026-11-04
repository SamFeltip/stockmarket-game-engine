import type { ChanceAction, NpcObservation, StockPrice, Holding } from "../../game-contracts/src";
import { rightsIssuePrice } from "../../../shared/rights-issue";

/** Card offers are validated by the game; strategy chooses the greatest immediate benefit. */
export function chooseChance(observation: NpcObservation): ChanceAction | undefined
{
    return observation.chanceOffers?.filter((offer) => offer.amount > 0)
        .toSorted((a, b) => b.amount - a.amount)[0]?.action;
}

export function rightsPurchase(price: number, maximum: number, cash: number, available: number): number
{
    return price > rightsIssuePrice
        ? Math.max(0, Math.min(maximum, Math.floor(cash / rightsIssuePrice), available)) : 0;
}

/** Suspension choices see the revealed settlement, never opponents' private cards during trading. */
export function suspensionChoice(holdings: readonly Holding[], opening: readonly StockPrice[],
    settled: readonly StockPrice[], suspended: readonly number[]): number | undefined
{
    const best = opening.filter((price) => !suspended.includes(price.stockKey))
        .map((price) => ({ stockKey: price.stockKey,
            benefit: (holdings.find((holding) => holding.stockKey === price.stockKey)?.quantity ?? 0)
              * (price.value - (settled.find((item) => item.stockKey === price.stockKey)?.value ?? price.value)) }))
        .toSorted((a, b) => b.benefit - a.benefit || a.stockKey - b.stockKey)[0];

    return best && best.benefit > 0 ? best.stockKey : undefined;
}
