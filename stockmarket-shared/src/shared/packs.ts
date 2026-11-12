import { gameLengths } from "./rules";

export const packIds = ["classic", "frantic", "tech", "crashing"] as const;
export type Pack = typeof packIds[number];

export const techMarketSteps = 12;
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

type GameLength = { pack?: Pack; periodCount: number };

export function legacyTechRounds(game: GameLength)
{
    // Older saves stored at least 48 rounds. New Tech games store at most 18 periods.
    return game.pack === "tech" && game.periodCount + 1 >= techLengths[0] * techMarketSteps;
}

export function gamePeriodCount(game: GameLength)
{
    return gamePeriodNumber(game, game.periodCount);
}

export function gamePeriodNumber(game: GameLength, period: number)
{
    return legacyTechRounds(game) ? Math.floor(period / techMarketSteps) + 1 : period + 1;
}

export function techMarketStep(game: GameLength & { currentPeriod: number })
{
    return legacyTechRounds(game) ? game.currentPeriod : game.currentPeriod * techMarketSteps;
}
