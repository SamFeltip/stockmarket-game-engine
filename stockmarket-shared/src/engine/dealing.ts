import type { MutationContext, QueryContext, Document_, Id } from "./model";
import { debentureInHand, debentureRuleFor, isStockRedemptionCard } from "../shared/debenture";
import { fail } from "./library";
import type { DeckCard } from "../shared/chance-cards";
import { deckForPack, forecastDealPeriod, shuffleDeck } from "./packDecks";

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

    return previous.filter((card) => isStockRedemptionCard(card.chanceKind) && debentureInHand(card, game.currentPeriod));
}

export async function privateForecasts(context: QueryContext, game: Document_<"games">, playerId: Id<"players">)
{
    if (game.pack !== "tech")
    {
        return [];
    }

    const hand = await playerPeriodInsights(context, playerId, forecastDealPeriod(game));

    return hand.filter((card) => card.forecast);
}

export function npcPeriodInsights(context: QueryContext, game: Document_<"games">, playerId: Id<"players">)
{
    return game.pack === "tech" ? privateForecasts(context, game, playerId)
        : playerPeriodInsights(context, playerId, game.currentPeriod);
}

export async function savedDeck(context: QueryContext, gameId: Id<"games">)
{
    const snapshot = await context.db.query("gameCatalogs").withIndex("by_game", (q) => q.eq("gameId", gameId)).unique();
    if (!snapshot?.cards.length)
    {
        fail("This game has no saved deck. Start a new game.");
    }

    return snapshot.cards;
}

export async function deal(context: MutationContext, game: Document_<"games">, players: Document_<"players">[],
    initialDeck?: DeckCard[])
{
    const deck = deckForPack(game.pack);
    const cards = initialDeck ?? await savedDeck(context, game._id);
    // Dealing creates the current hand, so only the preceding round can retain cards.
    const previous = game.currentPeriod === 0 ? [] : await context.db.query("playerInsights")
        .withIndex("by_game_period", (q) => q.eq("gameId", game._id).eq("period", game.currentPeriod - 1)).collect();
    const retained = previous.filter((card) => isStockRedemptionCard(card.chanceKind) && debentureInHand(card, game.currentPeriod));
    const heldIds = new Set(retained.map((card) => card.catalogCardId).filter(Boolean));
    const shuffled = shuffleDeck(context, cards.filter((card) => !heldIds.has(card.id)));
    const hands = deck.deal(context, game, shuffled, players.length);
    for (const [index, player] of players.entries())
    {
        for (const insight of hands[index])
        {
            await context.db.insert("playerInsights", {
                gameId: game._id, playerId: player._id, period: game.currentPeriod,
                stockKey: insight.stockKey, description: insight.description, value: insight.value, resolved: false,
                catalogCardId: insight.id, chanceKind: insight.chanceKind, forecast: insight.forecast,
                ...(isStockRedemptionCard(insight.chanceKind) && { debentureRule: debentureRuleFor(insight, game.pack) }),
            });
        }
    }
}
