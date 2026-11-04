import type { MutationContext, Document_ } from "./model";
import { members } from "./library";
import { rightsAvailable } from "../shared/rights-issue";
import { rightsPurchase } from "../packages/npc-engine/src/chance";

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

        const price = game.prices.find((item) => item.stockKey === issue.stockKey)?.value ?? 0;

        // Take a profitable retail offer within cash, otherwise decline it; no normal trading turn is spent.
        const available = rightsAvailable(await members(context, game._id), issue.stockKey);
        const quantity = rightsPurchase(price, offer.maximum, player.cash, available);

        game = await purchase(context, game, quantity);
    }
}
