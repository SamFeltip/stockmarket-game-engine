import type { MutationContext, Document_ } from "./model";
import { members, roundInsights } from "./library";
import { pendingSuspensions } from "../shared/suspensions";
import { withRoleBonuses } from "../shared/company-roles";
import { roundPrices } from "../shared/settlement";
import { chooseNpcAction } from "../packages/npc-engine/src/runtime";
import { spendSuspension } from "./suspensions";

/** Resolve automatic decisions through the portable policy boundary. */
export async function resolveNpcSuspensions(context: MutationContext, game: Document_<"games">)
{
    const players = await members(context, game._id);
    const insights = await roundInsights(context, game);
    const stocks = await context.db.query("stocks").collect();
    const queue = pendingSuspensions(game.currentPeriod, players, insights);
    for (const card of queue)
    {
        const owner = players.find((player) => player._id === card.playerId)!;
        if (owner.controller?.kind !== "npc")
        {
            break;
        }

        const prices = roundPrices(game.prices, withRoleBonuses(insights, players, stocks), stocks, game.suspended);
        const visible = game.prices.filter((price) =>
            stocks.some((stock) => stock.display && stock.key === price.stockKey));

        const { action } = chooseNpcAction({ phase: "suspension", holdings: owner.holdings,
            opening: visible, settled: prices, suspended: game.suspended });
        game = await spendSuspension(context, game, card, action.stockKey);
    }
}
