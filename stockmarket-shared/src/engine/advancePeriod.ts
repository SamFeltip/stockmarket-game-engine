import { deal } from "./dealing";
import type { MutationContext, Document_ } from "./model";
import { gameStocks, settlementInsights } from "./packRules";
import { roundCash, roundPrices, roundPriceSteps } from "../shared/settlement";
import { fail, feedItem, members, roundInsights } from "./library";

import { publicSeats } from "./legalActions";
import { gamePeriodNumber, legacyTechRounds, techMarketSteps } from "../shared/packs";
import { nextTradingSuspensions, pendingSuspensions } from "../shared/suspensions";

export async function advancePeriod(context: MutationContext, game: Document_<"games">, expectedPeriod: number)
{
    if ((game.status !== "closed" && game.status !== "special_insights") || game.currentPeriod !== expectedPeriod)
    {
        fail("The round has already changed");
    }

    const insights = await roundInsights(context, game);
    const stocks = await gameStocks(context, game);
    const holds = new Set(stocks.filter((stock) => stock.name === "Hold Stock Price").map((stock) => stock.key));
    if (insights.some((insight) => holds.has(insight.stockKey) && !insight.resolved))
    {
        fail("Wait for players to resolve their hold-stock insights");
    }

    const players = await members(context, game._id);
    if (pendingSuspensions(game.currentPeriod, players, insights).length > 0)
    {
        fail("Wait for Share Suspended decisions");
    }

    const effectiveInsights = settlementInsights(game, insights, players, stocks);
    const prices = roundPrices(game.prices, effectiveInsights, stocks, game.suspended);
    const tradingSuspensions = nextTradingSuspensions(game, players);
    for (const seat of players)
    {
        await context.db.patch(seat._id, { cash: roundCash(seat, insights, stocks) });
    }

    await context.db.insert("periodSummaries", { gameId: game._id, period: game.currentPeriod,
        opening: game.prices, settled: prices });
    const rankings = publicSeats(await members(context, game._id), { prices, tradingSuspensions });
    for (const seat of players)
    {
        await context.db.patch(seat._id, { periodStartRanking: rankings.find((item) =>
            item.id === seat._id)!.ranking });
    }

    const finished = game.currentPeriod >= game.periodCount;
    const currentPeriod = finished ? game.currentPeriod : game.currentPeriod + 1;
    const priceHistory = [
        ...game.priceHistory ?? [{ period: game.currentPeriod, prices: game.prices }],
        { period: game.currentPeriod + 1, prices,
            steps: roundPriceSteps(game.prices, effectiveInsights, stocks, game.suspended) },
    ];

    await context.db.patch(game._id, { prices, priceHistory, status: finished ? "finished" : "playing", currentPeriod,
        turn: 0, suspended: [], suspensionPeriod: undefined, targetedSuspensions: undefined,
        tradingSuspensions: tradingSuspensions.length ? tradingSuspensions : undefined,
        currentUserId: players[currentPeriod % players.length].userId,
        currentPlayerId: players[currentPeriod % players.length]._id });

    if (!finished)
    {
        await deal(context, { ...game, currentPeriod }, players);
        const period = gamePeriodNumber(game, currentPeriod);
        const title = legacyTechRounds(game)
            ? `Period ${period} · Round ${currentPeriod % techMarketSteps + 1}` : `Period ${period}`;

        await feedItem(context, { ...game, currentPeriod }, title,
            "Players get another turn", "/static/imgs/icons/Stock.svg", "grey");
        await context.effects.enqueueNextNpc(game._id);
    }
}
