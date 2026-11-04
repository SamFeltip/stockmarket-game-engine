export type CompanyRole = "chairman" | "director";

export const companyRoleThresholds = { chairman: 100_000, director: 50_000 } as const;

interface Seat {
    _id: string;
    holdings: { stockKey: number; quantity: number }[];
    chairmanSince?: { stockKey: number; order: number }[];
    directorSince?: { stockKey: number; order: number }[];
}

export function companyRoles(players: Seat[], stockKey: number)
{
    const quantity = (player: Seat) => player.holdings.find((holding) => holding.stockKey === stockKey)?.quantity ?? 0;
    // Stored qualification order survives periods. Legacy holdings use stable seat order.
    const chairman = players.filter((player) => quantity(player) >= companyRoleThresholds.chairman).toSorted((a, b) =>
        (a.chairmanSince?.find((item) => item.stockKey === stockKey)?.order ?? -1)
        - (b.chairmanSince?.find((item) => item.stockKey === stockKey)?.order ?? -1))[0];

    const director = players.filter((player) => player._id !== chairman?._id
      && quantity(player) >= companyRoleThresholds.director).toSorted((a, b) =>
        (a.directorSince?.find((item) => item.stockKey === stockKey)?.order ?? -1)
        - (b.directorSince?.find((item) => item.stockKey === stockKey)?.order ?? -1))[0];

    return players.flatMap<{ playerId: string; role: CompanyRole }>((player) => player._id === chairman?._id
        ? [{ playerId: player._id, role: "chairman" }]
        : (player._id === director?._id ? [{ playerId: player._id, role: "director" }] : []));
}

/** Preserve qualification priority; a retiring chairman cannot displace an incumbent director. */
export function roleQualification(player: Seat, stockKey: number, quantity: number, order: number,
    roleBefore?: CompanyRole)
{
    const before = player.holdings.find((holding) => holding.stockKey === stockKey)?.quantity ?? 0;
    const chairmanSince = (player.chairmanSince ?? []).filter((item) =>
        item.stockKey !== stockKey || quantity >= companyRoleThresholds.chairman);
    const directorSince = (player.directorSince ?? []).filter((item) => item.stockKey !== stockKey);
    if (before < companyRoleThresholds.chairman && quantity >= companyRoleThresholds.chairman)
    {
        chairmanSince.push({ stockKey, order });
    }

    if (quantity >= companyRoleThresholds.director)
    {
        const previous = player.directorSince?.find((item) => item.stockKey === stockKey);
        if (before < companyRoleThresholds.director
          || (roleBefore === "chairman" && quantity < companyRoleThresholds.chairman))
        {
            directorSince.push({ stockKey, order });
        }
        else if (previous)
        {
            directorSince.push(previous);
        }
    }

    return { chairmanSince, directorSince };
}

interface Card {
    _id: string; stockKey: number; playerId: string; value: number; description: string; resolved: boolean;
}

export function withRoleBonuses<T extends Card>(
    insights: T[], players: Seat[], stocks: { key: number; display: boolean }[],
): (T & { bonusRole?: CompanyRole; removedInsightId?: string })[]
{
    const bonuses: (T & { bonusRole: CompanyRole; removedInsightId: string })[] = [];
    for (const stock of stocks.filter((item) => item.display))
    {
        const roles = companyRoles(players, stock.key);
        const chairman = roles.find((item) => item.role === "chairman");
        const eligible = insights.filter((card) => card.stockKey === stock.key && card.value < 0
          && (chairman || roles.some((item) => item.playerId === card.playerId)));
        const worst = eligible.toSorted((a, b) => a.value - b.value || a._id.localeCompare(b._id))[0];
        const owner = chairman ?? roles.find((item) => item.playerId === worst?.playerId);
        if (worst && owner)
        {
            bonuses.push({ ...worst, _id: `bonus-${worst._id}` as T["_id"], playerId: owner.playerId,
                value: -worst.value, description: owner.role === "chairman" ? "chairman influence" : "director bonus", resolved: true,
                bonusRole: owner.role, removedInsightId: worst._id });
        }
    }

    return [...insights, ...bonuses];
}
