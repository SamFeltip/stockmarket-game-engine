/** Non-tradable keys kept separate from recovered/imported positive stock IDs. */
export const cashStockKey = -1;

export const chanceStockKey = -2;

export const governmentLoanAmount = 10_000;

export const chanceCards = [
    { kind: "rights", name: "Rights Issue", icon: "+", effect: "Buy extra shares at £1 each", description: "Choose one company. Every holder may immediately buy one extra share for every two they own, at £1 per extra share.", timing: "Uses one turn. Unused cards return to the deck at the end of the period." },
    { kind: "hold", name: "Share Suspended", icon: "＝", effect: "Freeze a company’s price", description: "Choose one company just before prices are adjusted at the end of the period. Its share price stays unchanged for that adjustment.", timing: "Play at period end, before prices change. Unused cards return to the deck." },
    { kind: "loan", name: "Government Loan", icon: `£${governmentLoanAmount / 1000}k`, effect: "Collect £10,000", description: "Your Government Loan has matured. Collect £10,000 from the stockbroker.", timing: "Uses one bargain (turn)" },
    { kind: "debenture", name: "Debenture", icon: "◇", effect: "Bankruptcy protection", description: "Retain this card as insurance. If a company goes bankrupt, claim the full purchase price of shares you still hold in that company.", timing: "Claim within two rounds of the bankruptcy" },
    { kind: "option", name: "Option", icon: "⇄", effect: "Not in the retail board game", description: "Option cards are not part of the retail board-game rules.", timing: "This card is unavailable." },
] as const;

export type ChanceKind = typeof chanceCards[number]["kind"];

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
}

/** Retail deck: 8 currency cards (4 each ±10%) and 8 chance cards; no Options. */
export function specialDeck(): DeckCard[]
{
    return [
        ...[10, -10].flatMap((percent) => Array.from({ length: 4 }, (_, copy) => ({
            id: `boardgame:cash:${percent}:${copy}`, stockKey: cashStockKey,
            value: percent / 100, description: `Cash ${percent > 0 ? "+" : ""}${percent}%`,
        }))),
        ...chanceCards.filter((card) => card.kind !== "option").flatMap((card) => Array.from({ length: 2 }, (_, copy) => ({
            id: `boardgame:chance:${card.kind}:${copy}`, stockKey: chanceStockKey,
            value: 0, description: card.name, chanceKind: card.kind,
        }))),
    ];
}

export function privateCashPercent(insights: { playerId: string; stockKey: number; value: number }[], playerId: string)
{
    return Math.round(insights.filter((card) => card.playerId === playerId && card.stockKey === cashStockKey)
        .reduce((sum, card) => sum + card.value, 0) * 100);
}
