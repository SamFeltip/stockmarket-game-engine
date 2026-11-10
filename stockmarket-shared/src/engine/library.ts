import type { MutationContext, QueryContext, Document_, Id } from "./model";
import { restoreDirectorPriority } from "./roleHistory";
import { debentureInHand } from "../shared/debenture";
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

export async function deal(context: MutationContext, game: Document_<"games">, players: Document_<"players">[])
{
    const snapshot = await context.db.query("gameCatalogs").withIndex("by_game", (q) => q.eq("gameId", game._id)).unique();
    const retained = (await context.db.query("playerInsights")
        .withIndex("by_game_period", (q) => q.eq("gameId", game._id)).collect())
        .filter((card) => card.chanceKind === "debenture" && debentureInHand(card, game.currentPeriod));
    const heldIds = new Set(retained.map((card) => card.catalogCardId).filter(Boolean));
    const catalog = snapshot?.cards ?? (await context.db.query("insights").collect())
        .map((card) => ({ ...card, id: String(card._id) }));
    const deck = catalog.filter((card) => !heldIds.has(card.id));
    if (deck.length < players.length * 10)
    {
        fail("Not enough insights for all players");
    }

    // Convex supplies seeded randomness that is stable across transaction retries.
    for (let index = deck.length - 1; index > 0; index--)
    {
        const index_ = Math.floor(context.random() * (index + 1));

        [deck[index], deck[index_]] = [deck[index_], deck[index]];
    }

    for (const [index, player] of players.entries())
    {
        for (const insight of deck.slice(index * 10, index * 10 + 10))
        {
            await context.db.insert("playerInsights", {
                gameId: game._id, playerId: player._id, period: game.currentPeriod,
                stockKey: insight.stockKey, description: insight.description, value: insight.value, resolved: false,
                catalogCardId: insight.id, chanceKind: "chanceKind" in insight ? insight.chanceKind : undefined,
            });
        }
    }
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
