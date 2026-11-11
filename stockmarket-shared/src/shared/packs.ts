export const packs = {
    classic: { name: "Classic", summary: "Trade the original stocks using the original insight and chance cards.", icon: "M3 21h18M5 21V9m5 12V9m4 12V9m5 12V9M2 9l10-6 10 6H2Z" },
    frantic: { name: "Frantic", summary: "Trade at triple the opening prices with bigger swings and extra chance cards.", icon: "m13 2-9 12h7l-1 8 10-12h-7l1-8Z" },
    tech: { name: "Tech", summary: "Trade six tech stocks through two years of real market history with private forecasts.", icon: "M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2 4h6v6H9V9ZM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3" },
    crashing: { name: "Crashing", summary: "Trade the original stocks through a 30% market-wide crash every third round.", icon: "m3 6 6 6 4-4 8 10m-6 0h6v-6" },
} as const;

export type Pack = keyof typeof packs;
export const packIds = Object.keys(packs) as Pack[];

export const techRoundsPerBlock = 12;
export const techMonths = 24;
export const techRoundCount = techRoundsPerBlock * techMonths / 2;

export function packRounds(pack: Pack | undefined, classicRounds: number)
{
    return pack === "tech" ? techRoundCount : classicRounds;
}

export function forecastPeriod(period: number)
{
    return period - period % techRoundsPerBlock;
}
