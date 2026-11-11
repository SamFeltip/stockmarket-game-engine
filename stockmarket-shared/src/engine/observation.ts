import { gameStocks } from "./packRules";
import type { NpcObservation } from "../packages/game-contracts/src";
import type { QueryContext, Document_ } from "./model";
import { legalActions } from "../packages/game-contracts/src";
import { members } from "./library";
import { playerPeriodInsights, privateForecasts } from "./dealing";
import { publicSeats } from "./legalActions";
import { chanceOffers } from "./chanceOffers";
export async function buildNpcObservation(
    context: QueryContext,
    game: Document_<"games">,
    self: Document_<"players">,
): Promise<NpcObservation>
{
    const players = await members(context, game._id);
    const hand = game.pack === "tech" ? await privateForecasts(context, game, self._id)
        : await playerPeriodInsights(context, self._id, game.currentPeriod);
    const catalog = await context.db
        .query("gameCatalogs")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .unique();
    if (!catalog)
    {
        throw new Error("Missing pinned NPC catalog");
    }

    const stocks = (await gameStocks(context, game)).filter((stock) => stock.display);
    const events = await context.db
        .query("gameActions")
        .withIndex("by_game_period_turn", (q) => q.eq("gameId", game._id))
        .collect();
    const settled = await context.db
        .query("periodSummaries")
        .withIndex("by_game_period", (q) => q.eq("gameId", game._id))
        .collect();
    const selfIndex = players.findIndex((seat) => seat._id === self._id);
    const market = {
        selfId: self._id,
        players: publicSeats(players, game.prices),
        prices: game.prices.filter((price) => stocks.some((stock) => stock.key === price.stockKey)),
    };
    const actionsRemaining = Math.max(1, 3 - Math.floor(game.turn / players.length)) as 1 | 2 | 3;

    return {
        ...market,
        ...(game.pack === "tech" ? { opponentDrawSize: 0 }
            : game.pack === "frantic" ? { opponentDrawSize: 12 } : {}),
        chanceOffers: await chanceOffers(context, game, self, players),
        period: game.currentPeriod,
        finalPeriod: game.periodCount,
        turn: game.turn,
        actionsRemaining,
        ownInsights: hand.filter((card) => !card.forecast || (card.forecast.from <= game.currentPeriod
          && game.currentPeriod < card.forecast.to)).map((card) => ({
            id: card.catalogCardId ?? String(card._id),
            stockKey: card.stockKey,
            value: card.forecast ? card.value / (card.forecast.to - card.forecast.from) : card.value,
        })),
        catalog: catalog.cards.map(({ id, stockKey, value }) => ({ id, stockKey, value })),
        events: events.filter((event) => !event.rightsIssueId).map(({ period, turn, actorPlayerId, action }) => ({
            period,
            turn,
            actorPlayerId,
            // Chance-card redemptions spend a turn but are not stock-price signals for NPCs.
            action: action.kind === "government-loan" || action.kind === "debenture" ? { kind: "pass" as const } : action,
        })),
        settledPeriods: settled.map(({ period, opening, settled }) => ({
            period,
            opening,
            settled,
        })),
        legalActions: legalActions(market),
        remainingSeatOrder: Array.from(
            { length: players.length - 1 },
            (_, index) => players[(selfIndex + index + 1) % players.length]._id,
        ),
        favouriteStockKey: stocks.find((stock) => stock.name === "Trusthouse Forte")?.key ?? -1,
    };
}
