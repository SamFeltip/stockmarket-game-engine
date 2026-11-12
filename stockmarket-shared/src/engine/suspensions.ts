import { gameStocks } from "./packRules";
import type { MutationContext, Document_, Id } from "./model";
import { fail, feedItem, members } from "./library";
import { publicIdentity } from "./identity";
import { rulesForPack } from "../shared/packs";
import { hasTargetedSuspension, stockholders } from "../shared/suspensions";
import { currentSuspension } from "./rounds";

export function checkSuspensionPhase(game: Document_<"games">, expectedPeriod: number)
{
    if ((game.status !== "closed" && game.status !== "special_insights") || game.currentPeriod !== expectedPeriod)
    {
        fail("The round has already changed");
    }
}

export async function spendSuspension(context: MutationContext, game: Document_<"games">,
    insightId: Id<"playerInsights">, stockKey?: number, playerIds?: readonly string[], actorId?: Id<"players">)
{
    checkSuspensionPhase(game, game.currentPeriod);
    const card = await currentSuspension(context, game, insightId);
    if (actorId !== undefined && card.playerId !== actorId)
    {
        fail("Wait for your Share Suspended card");
    }

    const stocks = await gameStocks(context, game);
    const owner = await context.db.get(card.playerId);
    if (!owner)
    {
        fail("Player not found");
    }

    const stock = stocks.find((item) => item.key === stockKey && item.display);
    let message = "skipped Share Suspended";
    const { targetedSuspensions } = rulesForPack(game.pack);
    if (playerIds !== undefined && (!targetedSuspensions || stockKey === undefined))
    {
        fail("Shareholder selection is unavailable for this decision");
    }

    if (stockKey !== undefined)
    {
        if (!stock)
        {
            fail("Choose a tradable stock");
        }

        if (game.suspended.includes(stockKey))
        {
            fail("This stock is already suspended");
        }

        if (targetedSuspensions)
        {
            const selected = new Set(playerIds);
            if (selected.size === 0 || selected.size !== playerIds?.length)
            {
                fail("Choose one or more shareholders");
            }

            const targets = stockholders(await members(context, game._id), stockKey).filter((seat) => selected.has(seat._id));
            if (targets.length !== selected.size)
            {
                fail("Choose players who hold this stock");
            }

            if (targets.some((seat) => hasTargetedSuspension(game.targetedSuspensions, stockKey, seat._id)))
            {
                fail("A selected shareholder is already suspended for this stock");
            }

            const previous = game.targetedSuspensions ?? [];
            const existing = previous.find((item) => item.stockKey === stockKey);
            const updated = [...previous.filter((item) => item.stockKey !== stockKey),
                { stockKey, playerIds: [...existing?.playerIds ?? [], ...targets.map((seat) => seat._id)] }];

            game = { ...game, targetedSuspensions: updated };
            await context.db.patch(game._id, { targetedSuspensions: updated });
            const names = await Promise.all(targets.map(async (seat) => (await publicIdentity(context, seat)).name));

            message = `suspended ${stock.name}’s price change for ${names.join(", ")}`;
        }
        else
        {
            game = { ...game, suspended: [...game.suspended, stockKey] };
            await context.db.patch(game._id, { suspended: game.suspended });
            message = `suspended ${stock.name}’s price change`;
        }
    }

    await context.db.patch(card._id, { used: true, resolved: true });
    const display = await publicIdentity(context, owner);

    await feedItem(context, game, display.name, message, display.profileRoot, "grey");

    return game;
}
