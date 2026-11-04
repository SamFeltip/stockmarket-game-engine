import type { MutationContext, Document_, Id } from "./model";
import { fail, members, roundInsights } from "./library";
import { pendingSuspensions } from "../shared/suspensions";
export async function holdStock(context: MutationContext, game: Document_<"games">, player: Document_<"players">,
    insightId: Id<"playerInsights">, stockKey?: number)
{
    if (game.status !== "closed" && game.status !== "special_insights")
    {
        fail("Wait for special insights");
    }

    const insight = await context.db.get(insightId);
    if (!insight || insight.gameId !== game._id || insight.period !== game.currentPeriod
      || insight.playerId !== player._id || insight.resolved)
    {
        fail("This insight cannot be used");
    }

    const special = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", insight.stockKey)).unique();
    if (special?.name !== "Hold Stock Price")
    {
        fail("This is not a hold-stock insight");
    }

    if (stockKey !== undefined)
    {
        const stock = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", stockKey)).unique();
        if (!stock?.display)
        {
            fail("Choose a tradable stock");
        }

        await context.db.patch(game._id, { suspended: [...new Set([...game.suspended, stockKey])] });
    }

    await context.db.patch(insightId, { resolved: true });
}
export async function currentSuspension(context: MutationContext, game: Document_<"games">, insightId: Id<"playerInsights">)
{
    if (game.suspensionPeriod !== game.currentPeriod)
    {
        fail("Wait until the stock and cash reveals are complete");
    }

    const players = await members(context, game._id);
    const insights = await roundInsights(context, game);
    const queue = pendingSuspensions(game.currentPeriod, players, insights);
    if (queue[0]?._id !== insightId)
    {
        fail("This Share Suspended decision has already changed");
    }

    return queue[0];
}
