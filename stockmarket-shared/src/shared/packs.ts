import { gameLengths } from "./rules";

export const packIds = ["classic", "frantic", "tech", "crashing"] as const;
export type Pack = typeof packIds[number];

export const techRoundsPerBlock = 12;
export const techMonthsPerPeriod = 2;
export const techDefaultPeriods = 12;
const techLengths = Array.from({ length: 15 }, (_, index) => index + 4);

export function packLengths(pack?: Pack)
{
    return pack === "tech" ? techLengths : gameLengths;
}

export function packDefaultPeriods(pack?: Pack)
{
    return pack === "tech" ? techDefaultPeriods : gameLengths[0];
}

export function packRoundsPerPeriod(pack?: Pack)
{
    return pack === "tech" ? techRoundsPerBlock : 1;
}

export function packRounds(pack: Pack | undefined, periods: number)
{
    return periods * packRoundsPerPeriod(pack);
}

export function packPeriods(pack: Pack | undefined, rounds: number)
{
    return Math.ceil(rounds / packRoundsPerPeriod(pack));
}

export function roundWithinPeriod(pack: Pack | undefined, round: number)
{
    return round % packRoundsPerPeriod(pack) + 1;
}

export function forecastPeriod(period: number)
{
    return period - period % techRoundsPerBlock;
}
