import type { MutationContext, QueryContext, Document_, Id } from "./model";
import { restoreDirectorPriority } from "./roleHistory";
import { cashStock } from "../shared/chance-cards";
import { portfolioWorth } from "../shared/settlement";
import { stockCatalog, insightCatalog } from "../catalog";
export class GameError extends Error {}
export function fail(message: string): never { throw new GameError(message); }
export async function members(context: QueryContext, gameId: Id<"games">)
{
    const seats = await context.db.query("players").withIndex("by_game", (q) => q.eq("gameId", gameId)).collect();

    const order = new Map(seats.map((seat, index) => [seat._id, seat.seatOrder ?? index]));

    return await restoreDirectorPriority(context, gameId,
        seats.toSorted((a, b) => order.get(a._id)! - order.get(b._id)!));
}

export async function seedCatalog(context: MutationContext)
{
    if (!await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", cashStock.key)).unique())
    {
        await context.db.insert("stocks", cashStock);
    }

    // Correct the old default for future games without changing saved game quotes or history.
    const natwest = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", 12)).unique();
    if (natwest?.startingValue === 9)
    {
        await context.db.patch(natwest._id, { startingValue: 8 });
    }

    if (await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", stockCatalog[0].key)).first())
    {
        return;
    }

    for (const stock of stockCatalog)
    {
        await context.db.insert("stocks", stock);
    }

    for (const insight of insightCatalog)
    {
        await context.db.insert("insights", insight);
    }
}

export async function roundInsights(context: QueryContext, game: Document_<"games">)
{
    return await context.db.query("playerInsights").withIndex("by_game_period", (q) =>
        q.eq("gameId", game._id).eq("period", game.currentPeriod)).collect();
}

export async function feedItem(context: MutationContext, game: Document_<"games">, title: string,
    message: string, imageRoot: string, colour = "", trade: Pick<Partial<Document_<"feed">>, "stockKey" | "quantity" | "cashBonus" | "debenturePayout" | "roleBefore" | "roleAfter"> = {})
{
    await context.db.insert("feed", { gameId: game._id, period: game.currentPeriod, title, message, imageRoot, colour, ...trade });
}

export function netWorth(player: Document_<"players">, game: Document_<"games">)
{
    return portfolioWorth(player, game.prices);
}
