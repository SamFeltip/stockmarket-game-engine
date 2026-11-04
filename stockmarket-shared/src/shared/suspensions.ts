/** Resolve chance cards in the current period's opening-seat order, one physical card at a time. */
export function pendingSuspensions<T extends { _id: string; playerId: string;
    period?: number; chanceKind?: string; used?: boolean; resolved: boolean }>(
    period: number, players: { _id: string }[], insights: T[],
): T[]
{
    const order = players.map((_, index) => players[(period + index) % players.length]._id);

    return insights.filter((card) => card.chanceKind === "hold" && !card.used && !card.resolved
      && (card.period === undefined || card.period === period))
        .toSorted((a, b) => order.indexOf(a.playerId) - order.indexOf(b.playerId) || a._id.localeCompare(b._id));
}
