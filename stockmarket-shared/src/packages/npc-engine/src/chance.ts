import type { ChanceAction, NpcObservation, StockPrice, Holding } from "../../game-contracts/src";
import { maxRightsPurchase, rightsIssuePrice } from "../../../shared/rights-issue";

/** Card offers are validated by the game; strategy chooses the greatest immediate benefit. */
export function chooseChance(observation: NpcObservation): ChanceAction | undefined
{
    return observation.chanceOffers?.filter((offer) => offer.amount > 0)
        .toSorted((a, b) => b.amount - a.amount)[0]?.action;
}

export function rightsPurchase(price: number, maximum: number, cash: number, available: number, issuePrice = rightsIssuePrice): number
{
    return price > issuePrice
        ? maxRightsPurchase(maximum, cash, available, issuePrice) : 0;
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

/** In Frantic, protect our falling positions or deny gains to rising rivals. */
export function targetedSuspensionChoice<Id extends string>(input: {
    selfId: Id; players: readonly { id: Id; holdings: readonly Holding[] }[];
    opening: readonly StockPrice[]; settled: readonly StockPrice[]; suspended: readonly number[];
    targeted?: readonly { stockKey: number; playerIds: readonly Id[] }[];
})
{
    let best: { stockKey: number; playerIds: Id[]; benefit: number } | undefined;
    for (const price of input.opening)
    {
        if (input.suspended.includes(price.stockKey))
        {
            continue;
        }

        const change = (input.settled.find((item) => item.stockKey === price.stockKey)?.value ?? price.value) - price.value;
        const alreadyTargeted = input.targeted?.find((item) => item.stockKey === price.stockKey)?.playerIds;
        const targets = input.players.flatMap((player) =>
        {
            const quantity = player.holdings.find((holding) => holding.stockKey === price.stockKey)?.quantity ?? 0;
            const benefit = quantity * change * (player.id === input.selfId ? -1 : 1);

            return benefit > 0 && !alreadyTargeted?.includes(player.id) ? [{ id: player.id, benefit }] : [];
        });
        const benefit = targets.reduce((sum, target) => sum + target.benefit, 0);
        if (benefit > (best?.benefit ?? 0))
        {
            best = { stockKey: price.stockKey, playerIds: targets.map((target) => target.id), benefit };
        }
    }

    return best;
}
