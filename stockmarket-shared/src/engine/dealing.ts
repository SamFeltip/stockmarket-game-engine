import type { MutationContext, QueryContext, Document_, Id } from "./model";
import { debentureInHand } from "../shared/debenture";
import { cashStockKey, chanceStockKey, specialDeck, type DeckCard } from "../shared/chance-cards";
import { forecastPeriod } from "../shared/packs";
import { fail } from "./library";
import { techForecasts, techStocks } from "./techMarket";

export async function playerPeriodInsights(context: QueryContext, playerId: Id<"players">, period: number)
{
    return await context.db.query("playerInsights").withIndex("by_player_period", (q) =>
        q.eq("playerId", playerId).eq("period", period)).collect();
}

export async function retainedDebentures(context: QueryContext, game: Document_<"games">, playerId: Id<"players">)
{
    if (game.currentPeriod === 0)
    {
        return [];
    }

    const previous = await playerPeriodInsights(context, playerId, game.currentPeriod - 1);

    return previous.filter((card) => card.chanceKind === "debenture" && debentureInHand(card, game.currentPeriod));
}

export async function privateForecasts(context: QueryContext, game: Document_<"games">, playerId: Id<"players">)
{
    if (game.pack !== "tech")
    {
        return [];
    }

    const hand = await playerPeriodInsights(context, playerId, forecastPeriod(game.currentPeriod));

    return hand.filter((card) => card.forecast);
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
    // Dealing creates the current hand, so only the preceding round can retain cards.
    const previous = game.currentPeriod === 0 ? [] : await context.db.query("playerInsights")
        .withIndex("by_game_period", (q) => q.eq("gameId", game._id).eq("period", game.currentPeriod - 1)).collect();
    const retained = previous.filter((card) => card.chanceKind === "debenture" && debentureInHand(card, game.currentPeriod));
    const heldIds = new Set(retained.map((card) => card.catalogCardId).filter(Boolean));
    // Tech games started before the chance deck was added have an empty catalog.
    const catalog = game.pack === "tech" && !snapshot?.cards.length ? specialDeck("tech")
        : snapshot?.cards ?? (await context.db.query("insights").collect())
            .map((card) => ({ ...card, id: String(card._id) }));

    return shuffle(context, catalog.filter((card) => !heldIds.has(card.id)));
}

function handsFor(context: MutationContext, game: Document_<"games">, deck: DeckCard[], seats: number): DeckCard[][]
{
    const chance = deck.filter((card) => card.stockKey === chanceStockKey);
    if (game.pack === "tech")
    {
        const cash = deck.filter((card) => card.stockKey === cashStockKey);
        if (chance.length < seats || cash.length < seats)
        {
            fail("Not enough chance or cash insights for all players");
        }

        // Fresh specials every round, with forecast windows dealt only at the start of their period.
        const forecasts = game.currentPeriod === forecastPeriod(game.currentPeriod)
            ? shuffle(context, techForecasts(game.techStart!, game.currentPeriod)).flat() : [];
        const forecastCount = techStocks.length * 2;

        return Array.from({ length: seats }, (_, index) => [chance[index], cash[index],
            ...forecasts.slice(index * forecastCount, (index + 1) * forecastCount)]);
    }

    const handSize = 10;
    const extraChancePerSeat = game.pack === "frantic" ? 2 : 0;
    const extras = chance.slice(0, seats * extraChancePerSeat);
    const extraIds = new Set(extras.map((card) => card.id));
    const regular = deck.filter((card) => !extraIds.has(card.id));
    if (regular.length < seats * handSize || extras.length < seats * extraChancePerSeat)
    {
        fail("Not enough insights for all players");
    }

    return Array.from({ length: seats }, (_, index) =>
        regular.slice(index * handSize, (index + 1) * handSize)
            .concat(extras.slice(index * extraChancePerSeat, (index + 1) * extraChancePerSeat)));
}

export async function deal(context: MutationContext, game: Document_<"games">, players: Document_<"players">[])
{
    const hands = handsFor(context, game, await dealDeck(context, game), players.length);
    for (const [index, player] of players.entries())
    {
        for (const insight of hands[index])
        {
            await context.db.insert("playerInsights", {
                gameId: game._id, playerId: player._id, period: game.currentPeriod,
                stockKey: insight.stockKey, description: insight.description, value: insight.value, resolved: false,
                catalogCardId: insight.id, chanceKind: insight.chanceKind, forecast: insight.forecast,
            });
        }
    }
}
