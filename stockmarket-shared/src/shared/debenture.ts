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
