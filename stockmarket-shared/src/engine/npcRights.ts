import { tradingQuote } from "../shared/suspensions";
import type { QueryContext, MutationContext, Document_ } from "./model";
import { members } from "./library";
import { rightsAvailable, rightsPriceFor } from "../shared/rights-issue";
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

        game = await purchase(context, game, await npcRightsQuantity(context, game, issue, player));
    }
}

export async function npcRightsQuantity(context: QueryContext, game: Document_<"games">,
    issue: NonNullable<Document_<"games">["rightsIssue"]>, player: Document_<"players">)
{
    const price = tradingQuote(game, issue.stockKey, player._id) ?? 0;
    const available = rightsAvailable(await members(context, game._id), issue.stockKey);
    const { action } = chooseNpcAction({ phase: "rights", price, maximum: issue.offers[issue.index].maximum,
        cash: player.cash, available, issuePrice: rightsPriceFor(game.pack, price) });

    return action.quantity;
}
