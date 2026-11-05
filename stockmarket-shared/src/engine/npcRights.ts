import type { MutationContext, Document_ } from "./model";
import { members } from "./library";
import { rightsAvailable } from "../shared/rights-issue";
import { chooseNpcAction } from "../packages/npc-engine/src/runtime";

export async function advanceNpcRights(context: MutationContext, game: Document_<"games">,
    purchase: (context: MutationContext, game: Document_<"games">, quantity: number) => Promise<Document_<"games">>)
{
    while (game.rightsIssue && !game.rightsIssue.completed)
    {
        const issue = game.rightsIssue;
        const offer = issue.offers[issue.index];
        const player = (await context.db.get(offer.playerId))!;
        if (player.controller?.kind !== "npc")
        {
            break;
        }

        if (context.effects.npcRightsLater)
        {
            await context.effects.npcRightsLater({ gameId: game._id, insightId: issue.insightId, index: issue.index });

            return;
        }

        const price = game.prices.find((item) => item.stockKey === issue.stockKey)?.value ?? 0;

        const available = rightsAvailable(await members(context, game._id), issue.stockKey);
        const { action } = chooseNpcAction({ phase: "rights", price, maximum: offer.maximum,
            cash: player.cash, available });

        game = await purchase(context, game, action.quantity);
    }
}
