import type { ChanceKind, DebentureRule } from "./chance-cards";
import type { Pack } from "./packs";

export function isStockRedemptionCard(kind?: ChanceKind): kind is "debenture" | "bankruptcy-buyout"
{
    return kind === "debenture" || kind === "bankruptcy-buyout";
}

/** Cards saved before variants were introduced use the rule of their original deck. */
export function debentureRuleFor(card: { chanceKind?: ChanceKind; debentureRule?: DebentureRule }, pack?: Pack): DebentureRule
{
    if (card.chanceKind === "bankruptcy-buyout")
    {
        return "fixed-bankruptcy";
    }

    return card.debentureRule ?? (pack === "tech" ? "price-drop" : "bankruptcy");
}

/** A debenture can be used in the period it was dealt and the following period. */
export function debentureInHand(card: { period: number; used?: boolean }, currentPeriod: number)
{
    return !card.used && card.period <= currentPeriod && currentPeriod < card.period + 2;
}

interface Price { stockKey: number; value: number }
interface Snapshot { period: number; prices: Price[] }

/** The two claim rounds are the first two trading periods after the price reaches zero. */
export function bankruptcyPeriod(stockKey: number, history: Snapshot[], currentPeriod: number): number | null
{
    let solvent = false;
    let bankrupt: number | null = null;
    const snapshots = history.filter((item) => item.period <= currentPeriod).toSorted((a, b) => a.period - b.period);
    for (const snapshot of snapshots)
    {
        const price = snapshot.prices.find((item) => item.stockKey === stockKey)?.value;
        if (price !== undefined && price > 0)
        {
            solvent = true;
            bankrupt = null;
        }
        else if (price !== undefined && price <= 0 && solvent && bankrupt === null)
        {
            bankrupt = snapshot.period;
        }
    }

    return bankrupt;
}
