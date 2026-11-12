import type { MutationContext, Document_, Id } from "./model";
import { members, roundInsights } from "./library";
import { rulesForPack } from "../shared/packs";
import { pendingSuspensions } from "../shared/suspensions";
import { gameStocks, settlementInsights } from "./packRules";
import { roundPrices } from "../shared/settlement";
import { chooseNpcAction } from "../packages/npc-engine/src/runtime";
import { targetedSuspensionChoice } from "../packages/npc-engine/src/chance";
import { spendSuspension } from "./suspensions";

/** Let the live adapter show each decision before spending the card. */
export async function advanceNpcSuspensions(context: MutationContext, game: Document_<"games">,
    expectedInsightId?: Id<"playerInsights">): Promise<void>
{
    if ((game.status !== "closed" && game.status !== "special_insights")
      || game.suspensionPeriod !== game.currentPeriod)
    {
        return;
    }

    const players = await members(context, game._id);
    const insights = await roundInsights(context, game);
    const [card] = pendingSuspensions(game.currentPeriod, players, insights);
    const owner = players.find((player) => player._id === card?.playerId);
    if (!card || owner?.controller?.kind !== "npc" || (expectedInsightId && card._id !== expectedInsightId))
    {
        return;
    }

    if (!expectedInsightId && context.effects.npcSuspensionLater)
    {
        await context.effects.npcSuspensionLater({ gameId: game._id, insightId: card._id });

        return;
    }

    const stocks = await gameStocks(context, game);
    const prices = roundPrices(game.prices, settlementInsights(game, insights, players, stocks), stocks, game.suspended);
    const visible = game.prices.filter((price) => stocks.some((stock) => stock.display && stock.key === price.stockKey));
    const { targetedSuspensions } = rulesForPack(game.pack);
    const choice = targetedSuspensions
        ? (game.currentPeriod < game.periodCount ? targetedSuspensionChoice({
            selfId: owner._id, players: players.map((player) => ({ id: player._id, holdings: player.holdings })),
            opening: visible, settled: prices, suspended: game.suspended, targeted: game.targetedSuspensions,
        }) : undefined)
        : chooseNpcAction({ phase: "suspension", holdings: owner.holdings,
            opening: visible, settled: prices, suspended: game.suspended }).action;
    const updated = await spendSuspension(context, game, card._id, choice?.stockKey,
        choice && "playerIds" in choice ? choice.playerIds : undefined, owner._id);

    await advanceNpcSuspensions(context, updated);
}
