import { gameLengths, startingCash } from "./rules";

export const packIds = ["classic", "frantic", "tech"] as const;
export type Pack = typeof packIds[number];

export const techMarketSteps = 12;
export const techMonthsPerPeriod = 2;
export const techDefaultPeriods = 12;
const techLengths = Array.from({ length: 15 }, (_, index) => index + 4);

/** Gameplay settings shared by the engine and the lobby for a play style. */
export interface PackRules {
    /** Allowed game lengths in trading periods. */
    readonly lengths: readonly number[];
    /** Length selected when a lobby first uses this group. */
    readonly defaultPeriods: number;
    /** Play styles in the same group share the lobby's saved length selection. */
    readonly lengthGroup: "standard" | "extended";
    /** Cash assigned to each seat when setting up the lobby. */
    readonly openingCash: number;
    /** Whether launch reapplies the opening balance to every seat. */
    readonly resetCashAtLaunch: boolean;
    /** Cash paid when a Government Loan card is redeemed. */
    readonly loanAmount: number;
    /** Whether Share Suspended applies to chosen shareholders. */
    readonly targetedSuspensions: boolean;
    /** Entitlement and pricing settings for a Rights Issue. */
    readonly rights: {
        /** Extra shares per share held when the issue opens, before rounding to a trade lot. */
        readonly sharesPerHolding: number;
        /** Percentage of the market quote. Omit for the fixed retail price. */
        readonly marketPricePercent?: number;
    };
}

/** Retail rules inherited by play styles that only override part of the game. */
const standardRules: PackRules = {
    lengths: gameLengths,
    defaultPeriods: gameLengths[0],
    lengthGroup: "standard",
    openingCash: startingCash,
    resetCashAtLaunch: false,
    loanAmount: 10_000,
    targetedSuspensions: false,
    rights: { sharesPerHolding: 0.5, marketPricePercent: undefined },
};

const rulesByPack: Record<Pack, PackRules> = {
    classic: standardRules,
    frantic: {
        ...standardRules,
        loanAmount: 30_000,
        targetedSuspensions: true,
        rights: { ...standardRules.rights, sharesPerHolding: 10 },
    },
    tech: {
        ...standardRules,
        lengths: techLengths,
        defaultPeriods: techDefaultPeriods,
        lengthGroup: "extended",
        openingCash: 3_000_000,
        resetCashAtLaunch: true,
        loanAmount: 100_000,
        rights: { ...standardRules.rights, marketPricePercent: 80 },
    },
};

/** Resolve play-style rules, defaulting games saved without a pack to Classic. */
export function rulesForPack(pack: Pack = "classic"): PackRules
{
    return rulesByPack[pack];
}

export function packLengths(pack?: Pack)
{
    return rulesForPack(pack).lengths;
}

export function packDefaultPeriods(pack?: Pack)
{
    return rulesForPack(pack).defaultPeriods;
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
