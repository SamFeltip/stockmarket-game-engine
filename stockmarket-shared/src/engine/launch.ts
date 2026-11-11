import type { MutationContext, Document_ } from "./model";
import { specialDeck } from "../shared/chance-cards";
import { minimumPlayers, maximumPlayers } from "../shared/rules";
import { deal, fail, feedItem, members, seedCatalog } from "./library";
import { spectatorHost } from "./hosting";
import { franticDeck, gameStocks, validPackLength } from "./packRules";
import { packPeriods } from "../shared/packs";
import { chooseTechStart, techPrices } from "./techMarket";

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

    const periods = packPeriods(game.pack, game.periodCount + 1);
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

    await seedCatalog(context);
    const cards = game.pack === "tech" ? [] : await context.db.query("insights").collect();
    const stocks = await gameStocks(context, game);
    if (hasNpcs && cards.some((card) => !stocks.some((stock) => stock.key === card.stockKey && stock.display)))
    {
        fail("NPC games require an ordinary-only insight catalog");
    }

    const catalogVersion = `${!game.pack || game.pack === "classic" ? "boardgame-108-v2" : game.pack}:${game._id}`;
    const ordinary = cards.map((card) => ({ id: String(card._id), stockKey: card.stockKey, value: card.value,
        description: card.description }));
    const deck = game.pack === "tech" ? [] : (game.pack === "frantic" ? franticDeck(ordinary) : ordinary.concat(specialDeck()));

    await context.db.insert("gameCatalogs", { gameId: game._id, version: catalogVersion, cards: deck });

    for (const [index, seat] of players.entries())
    {
        await context.db.patch(seat._id, { seatOrder: index, periodStartRanking: index + 1,
            controller: seat.controller ?? { kind: "human", userId: seat.userId! } });
    }

    let market;
    if (game.pack === "tech")
    {
        const techStart = chooseTechStart(context.random(), periods);
        const prices = techPrices(techStart, 0);

        market = { techStart, prices, priceHistory: [{ period: 0, prices }] };
    }

    await deal(context, { ...game, ...market }, players);
    await context.db.patch(game._id, { ...market, status: "playing", currentPlayerId: players[0]._id,
        currentUserId: players[0].userId, rulesVersion: 2, catalogVersion });
    await feedItem(context, game, "game started", "game started", "/static/imgs/icons/Handshake.svg", "grey");
    await context.effects.enqueueNextNpc(game._id);
}
