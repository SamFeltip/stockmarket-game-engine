import type { MutationContext, Document_ } from "./model";
import { members, roundInsights } from "./library";
import { pendingSuspensions } from "../shared/suspensions";
import { withRoleBonuses } from "../shared/company-roles";
import { roundPrices } from "../shared/settlement";
import { suspensionChoice } from "../packages/npc-engine/src/chance";
import { spendSuspension } from "./suspensions";

/** NPCs protect the largest loss in their portfolio, otherwise discard their card. */
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

        game = await spendSuspension(context, game, card,
            suspensionChoice(owner.holdings, visible, prices, game.suspended));
    }
}
