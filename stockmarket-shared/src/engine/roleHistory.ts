import type { QueryContext, Document_, Id } from "./model";
import { companyRoles, companyRoleThresholds, roleQualification } from "../shared/company-roles";

/** Recover priority for existing games from recorded trades, never from seat order when history is complete. */
export async function restoreDirectorPriority(context: QueryContext, gameId: Id<"games">,
    players: Document_<"players">[])
{
    if (!players.some((player) => player.directorSince === undefined
      && player.holdings.some((holding) => holding.quantity >= companyRoleThresholds.director)))
    {
        return players;
    }

    const events = await context.db.query("gameActions")
        .withIndex("by_game_period_turn", (q) => q.eq("gameId", gameId)).collect();
    const replay = players.map((player) => ({ ...player,
        holdings: player.holdings.map((holding) => ({ ...holding, quantity: 0 })),
        chairmanSince: [] as { stockKey: number; order: number }[],
        directorSince: [] as { stockKey: number; order: number }[],
    }));
    for (const [index, event] of events.entries())
    {
        const action = event.action;
        if (action.kind === "pass" || action.kind === "government-loan")
        {
            continue;
        }

        const player = replay.find((seat) => seat._id === event.actorPlayerId);
        if (!player)
        {
            continue;
        }

        const before = player.holdings.find((holding) => holding.stockKey === action.stockKey)?.quantity ?? 0;
        const quantity = action.kind === "debenture" ? 0
            : before + (action.kind === "buy" ? action.quantity : -action.quantity);
        const role = companyRoles(replay, action.stockKey).find((item) => item.playerId === player._id)?.role;
        const qualification = roleQualification(player, action.stockKey, quantity,
            event.period * 100 + event.turn + (index + 1) / 100_000, role);

        Object.assign(player, qualification);
        player.holdings = player.holdings.filter((holding) => holding.stockKey !== action.stockKey)
            .concat({ stockKey: action.stockKey, quantity });
    }

    return players.map((player, index) =>
    {
        const recorded = replay[index];
        const matches = [...player.holdings, ...recorded.holdings].every(({ stockKey }) =>
            (player.holdings.find((holding) => holding.stockKey === stockKey)?.quantity ?? 0)
            === (recorded.holdings.find((holding) => holding.stockKey === stockKey)?.quantity ?? 0));

        return player.directorSince === undefined && matches
            ? { ...player, directorSince: recorded.directorSince } : player;
    });
}
