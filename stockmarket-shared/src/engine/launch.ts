import { deal } from "./dealing";
import type { MutationContext, Document_ } from "./model";
import { minimumPlayers, maximumPlayers } from "../shared/rules";
import { fail, feedItem, members, seedStocks } from "./library";
import { spectatorHost } from "./hosting";
import { gameStocks, launchMarket, validPackLength } from "./packRules";
import { gamePeriodCount, rulesForPack } from "../shared/packs";
import { buildDeck, deckForPack } from "./packDecks";

export async function launchGame(context: MutationContext, game: Document_<"games">, allowNpcs = true)
{
    if (game.status !== "waiting")
    {
        fail("The game has already started");
    }

    const players = await members(context, game._id);
    if (players.length < minimumPlayers)
    {
        fail("At least four players are required");
    }

    const periods = gamePeriodCount(game);
    if (!validPackLength(game.pack, periods - 1))
    {
        fail("Invalid game length");
    }

    if (players.length > maximumPlayers || (!players.some((seat) => seat.userId) && !spectatorHost(game, players)))
    {
        fail("Invalid player roster");
    }

    const hasNpcs = players.some((seat) => seat.controller?.kind === "npc");
    if (hasNpcs && !allowNpcs)
    {
        fail("New NPC games are temporarily unavailable");
    }

    await seedStocks(context);
    const rules = rulesForPack(game.pack);
    const pack = game.pack ?? "classic";
    const deck = deckForPack(pack);
    const cards = buildDeck(pack);
    const stockCards = cards.filter((card) => card.stockKey > 0);
    if (hasNpcs && stockCards.length > 0)
    {
        const stocks = await gameStocks(context, game);
        if (stockCards.some((card) => !stocks.some((stock) => stock.key === card.stockKey && stock.display)))
        {
            fail("NPC games require the deck’s ordinary stocks to be tradable");
        }
    }

    const catalogVersion = `${deck.catalogVersion ?? pack}:${game._id}`;
    await context.db.insert("gameCatalogs", { gameId: game._id, version: catalogVersion, cards });

    for (const [index, seat] of players.entries())
    {
        await context.db.patch(seat._id, { seatOrder: index, periodStartRanking: index + 1,
            ...(rules.resetCashAtLaunch && { cash: rules.openingCash }),
            controller: seat.controller ?? { kind: "human", userId: seat.userId! } });
    }

    const market = launchMarket(game.pack, () => context.random(), periods);

    await deal(context, { ...game, ...market }, players, cards);
    await context.db.patch(game._id, { ...market, status: "playing", currentPlayerId: players[0]._id,
        currentUserId: players[0].userId, rulesVersion: 2, catalogVersion });
    await feedItem(context, game, "game started", "game started", "/static/imgs/icons/Handshake.svg", "grey");
    await context.effects.enqueueNextNpc(game._id);
}
