import { rulesForPack, type Pack } from "./packs";

/** Non-tradable keys kept separate from recovered/imported positive stock IDs. */
export const cashStockKey = -1;

export const chanceStockKey = -2;

export const governmentLoanAmount = rulesForPack().loanAmount;

export function loanAmount(pack?: Pack)
{
    return rulesForPack(pack).loanAmount;
}

export const bankruptcyBuyoutName = "Bankruptcy Buyout";
export const bankruptcyBuyoutPrice = 100;

export const bankruptcyBuyoutCard = {
    kind: "bankruptcy-buyout", name: bankruptcyBuyoutName, icon: `£${bankruptcyBuyoutPrice}`,
    effect: `Sell bankrupt shares for £${bankruptcyBuyoutPrice} each`,
    description: `Sell all your shares in one bankrupt company for £${bankruptcyBuyoutPrice} per share.`,
    timing: "Claim within two rounds of the bankruptcy",
} as const;

export const chanceCards = [
    { kind: "rights", name: "Rights Issue", icon: "+", effect: "Buy extra shares at £1 each", description: "Choose one company. Every holder may immediately buy one extra share for every two they own, at £1 per extra share.", timing: "Uses one turn. Unused cards return to the deck at the end of the period." },
    { kind: "hold", name: "Share Suspended", icon: "＝", effect: "Freeze a company’s price", description: "Choose one company just before prices are adjusted at the end of the period. Its share price stays unchanged for that adjustment.", timing: "Play at period end, before prices change. Unused cards return to the deck." },
    { kind: "loan", name: "Government Loan", icon: `£${governmentLoanAmount / 1000}k`, effect: "Collect £10,000", description: "Your Government Loan has matured. Collect £10,000 from the stockbroker.", timing: "Uses one bargain (turn)" },
    { kind: "print-money", name: "Print Money", icon: "×2", effect: "Double your cash", description: "Double the cash you have when you play this card.", timing: "Uses one bargain (turn)" },
    { kind: "debenture", name: "Debenture", icon: "◇", effect: "Bankruptcy protection", description: "Retain this card as insurance. If a company goes bankrupt, claim the full purchase price of shares you still hold in that company.", timing: "Claim within two rounds of the bankruptcy" },
    bankruptcyBuyoutCard,
    { kind: "option", name: "Option", icon: "⇄", effect: "Not in the retail board game", description: "Option cards are not part of the retail board-game rules.", timing: "This card is unavailable." },
] as const;

export type ChanceKind = typeof chanceCards[number]["kind"];
export type DebentureRule = "bankruptcy" | "price-drop" | "fixed-bankruptcy";

/** Resolve an immediate cash card against the balance at the moment it is played. */
export function cashCardAward(kind: ChanceKind | undefined, pack: Pack | undefined, cash: number)
{
    if (kind === "loan")
    {
        return { amount: loanAmount(pack), message: "received government bonus" };
    }

    if (kind === "print-money")
    {
        return { amount: Math.max(0, cash), message: "played Print Money" };
    }
}

export const cashStock = {
    key: cashStockKey, name: "Cash", display: false, variation: 0, startingValue: 0,
    imagePath: "/static/imgs/icons/cash.svg", secondaryImagePath: "/static/imgs/icons/cash.svg",
};

export interface DeckCard {
    id: string;
    stockKey: number;
    value: number;
    description: string;
    chanceKind?: ChanceKind;
    debentureRule?: DebentureRule;
    forecast?: { from: number; to: number };
}

const retailSpecialCards = { cashPercents: [10, -10], cashCopies: 4, chanceCopies: 2, cashCard: "loan", stockCard: "debenture", debentureRule: "bankruptcy" } as const;
const specialCardsByPack = {
    classic: retailSpecialCards,
    frantic: { ...retailSpecialCards, cashPercents: [50, -30], cashCopies: 6, chanceCopies: 5, cashCard: "print-money",
        stockCard: "bankruptcy-buyout", debentureRule: "fixed-bankruptcy" },
    tech: { ...retailSpecialCards, cashPercents: [2, -2], debentureRule: "price-drop" },
} satisfies Record<Pack, { cashPercents: readonly number[]; cashCopies: number; chanceCopies: number; cashCard: "loan" | "print-money"; stockCard: "debenture" | "bankruptcy-buyout"; debentureRule: DebentureRule }>;

export function specialDeck(pack: Pack = "classic"): DeckCard[]
{
    const { cashPercents, cashCopies, chanceCopies, cashCard, stockCard, debentureRule } = specialCardsByPack[pack];

    return [
        ...cashPercents.flatMap((percent) => Array.from({ length: cashCopies }, (_, copy) => ({
            id: `boardgame:cash:${percent}:${copy}`, stockKey: cashStockKey,
            value: percent / 100, description: `Cash ${percent > 0 ? "+" : ""}${percent}%`,
        }))),
        ...chanceCards.filter((card) => card.kind === cashCard
          || card.kind === "rights" || card.kind === "hold" || card.kind === stockCard).flatMap((card) => Array.from({ length: chanceCopies }, (_, copy) => ({
            id: `boardgame:chance:${card.kind}:${copy}`, stockKey: chanceStockKey,
            value: 0, description: card.name, chanceKind: card.kind,
            ...(card.kind === stockCard && { debentureRule }),
        }))),
    ];
}

export function privateCashPercent(insights: { playerId: string; stockKey: number; value: number }[], playerId: string)
{
    return Math.round(insights.filter((card) => card.playerId === playerId && card.stockKey === cashStockKey)
        .reduce((sum, card) => sum + card.value, 0) * 100);
}
