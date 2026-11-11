import type { MutationContext, QueryContext, Document_, Id } from "./model";
import { restoreDirectorPriority } from "./roleHistory";
import { debentureInHand } from "../shared/debenture";
import { cashStock, chanceStockKey, type DeckCard } from "../shared/chance-cards";
import { portfolioWorth } from "../shared/settlement";
import { stockCatalog, insightCatalog } from "../catalog";
import { forecastPeriod } from "../shared/packs";
import { techForecasts, techStocks } from "./techMarket";
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

export async function privateForecasts(context: QueryContext, game: Document_<"games">, playerId: Id<"players">)
{
    return game.pack === "tech" ? context.db.query("playerInsights").withIndex("by_player_period", (q) =>
        q.eq("playerId", playerId).eq("period", forecastPeriod(game.currentPeriod))).collect() : [];
}

function shuffle<T>(context: MutationContext, deck: T[])
{
    // Convex supplies seeded randomness that is stable across transaction retries.
    for (let index = deck.length - 1; index > 0; index--)
    {
        const pick = Math.floor(context.random() * (index + 1));

        [deck[index], deck[pick]] = [deck[pick], deck[index]];
    }

    return deck;
}

async function dealDeck(context: MutationContext, game: Document_<"games">): Promise<DeckCard[]>
{
    const snapshot = await context.db.query("gameCatalogs").withIndex("by_game", (q) => q.eq("gameId", game._id)).unique();
    const retained = (await context.db.query("playerInsights")
        .withIndex("by_game_period", (q) => q.eq("gameId", game._id)).collect())
        .filter((card) => card.chanceKind === "debenture" && debentureInHand(card, game.currentPeriod));
    const heldIds = new Set(retained.map((card) => card.catalogCardId).filter(Boolean));
    const catalog = snapshot?.cards ?? (await context.db.query("insights").collect())
        .map((card) => ({ ...card, id: String(card._id) }));

    return shuffle(context, catalog.filter((card) => !heldIds.has(card.id)));
}

export async function deal(context: MutationContext, game: Document_<"games">, players: Document_<"players">[])
{
    const tech = game.pack === "tech";
    if (tech && game.currentPeriod !== forecastPeriod(game.currentPeriod))
    {
        return;
    }

    // Keep all companies for a forecast window together so every player gets exclusive windows.
    const deck = tech ? shuffle(context, techForecasts(game.techStart!, game.currentPeriod)).flat()
        : await dealDeck(context, game);
    const handSize = tech ? techStocks.length * 2 : 10;
    if (deck.length < players.length * handSize)
    {
        fail("Not enough insights for all players");
    }

    // Two guaranteed chance cards per Frantic seat, in addition to the ten-card hand.
    const chance = game.pack === "frantic" ? deck.filter((card) => card.stockKey === chanceStockKey) : [];
    const extras = chance.slice(0, players.length * 2);
    const extraIds = new Set(extras.map((card) => card.id));
    const regular = deck.filter((card) => !extraIds.has(card.id));
    for (const [index, player] of players.entries())
    {
        for (const insight of regular.slice(index * handSize, (index + 1) * handSize).concat(extras.slice(index * 2, index * 2 + 2)))
        {
            await context.db.insert("playerInsights", {
                gameId: game._id, playerId: player._id, period: game.currentPeriod,
                stockKey: insight.stockKey, description: insight.description, value: insight.value, resolved: false,
                catalogCardId: insight.id, chanceKind: insight.chanceKind, forecast: insight.forecast,
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
