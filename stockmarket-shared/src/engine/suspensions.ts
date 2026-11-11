import { gameStocks } from "./packRules";
import type { MutationContext, Document_ } from "./model";
import { fail, feedItem } from "./library";
import { publicIdentity } from "./identity";

export function checkSuspensionPhase(game: Document_<"games">, expectedPeriod: number)
{
    if ((game.status !== "closed" && game.status !== "special_insights") || game.currentPeriod !== expectedPeriod)
    {
        fail("The round has already changed");
    }
}

export async function spendSuspension(context: MutationContext, game: Document_<"games">,
    card: Document_<"playerInsights">, stockKey?: number)
{
    const stocks = await gameStocks(context, game);
    const owner = await context.db.get(card.playerId);
    if (!owner)
    {
        fail("Player not found");
    }

    if (stockKey !== undefined)
    {
        if (!stocks.some((stock) => stock.display && stock.key === stockKey))
        {
            fail("Choose a tradable stock");
        }

        if (game.suspended.includes(stockKey))
        {
            fail("This stock is already suspended");
        }

        game = { ...game, suspended: [...game.suspended, stockKey] };
        await context.db.patch(game._id, { suspended: game.suspended });
    }

    await context.db.patch(card._id, { used: true, resolved: true });
    const display = await publicIdentity(context, owner);
    const stock = stocks.find((item) => item.key === stockKey);

    await feedItem(context, game, display.name, stock ? `suspended ${stock.name}’s price change` : "skipped Share Suspended",
        display.profileRoot, "grey");

    return game;
}
