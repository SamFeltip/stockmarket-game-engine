import { gameStocks } from "./packRules";
import type { MutationContext, Document_, Id } from "./model";
import { members, fail, feedItem } from "./library";
import { isCurrent } from "./seats";
import { finishTurn } from "./commands";
import { publicIdentity } from "./identity";
import { rightsMaximum, rightsIssueOrder, rightsPriceFor, rightsPurchaseError, rightsAvailable } from "../shared/rights-issue";
import { companyRoles, roleQualification } from "../shared/company-roles";
import { advanceNpcRights } from "./npcRights";
import { chanceStockKey } from "../shared/chance-cards";
import { roundMoney } from "../shared/rules";
export async function activateRightsIssue(context: MutationContext, game: Document_<"games">,
    player: Document_<"players">, display: { name: string; profileRoot: string },
    command: { expectedPeriod: number; expectedTurn: number; insightId: Document_<"playerInsights">["_id"]; stockKey: number })
{
    if (game.rightsIssue)
    {
        fail("A Rights Issue is already in progress");
    }

    if (game.status !== "playing" || !isCurrent(game, player))
    {
        fail("It is not your turn");
    }

    if (command.expectedPeriod !== game.currentPeriod || command.expectedTurn !== game.turn)
    {
        fail("The turn has changed; try again");
    }

    const card = await context.db.get(command.insightId);
    if (!card || card.gameId !== game._id || card.playerId !== player._id || card.period !== game.currentPeriod
      || card.stockKey !== chanceStockKey || card.chanceKind !== "rights" || card.used || card.resolved)
    {
        fail("This Rights Issue card cannot be used");
    }

    const stocks = await gameStocks(context, game);
    const stock = stocks.find((item) => item.key === command.stockKey && item.display);
    const seats = await members(context, game._id);
    const offers = rightsIssueOrder(seats, player._id).flatMap((seat) =>
    {
        const held = seat.holdings.find((holding) => holding.stockKey === command.stockKey)?.quantity ?? 0;

        return held > 0 || (game.pack === "frantic" && seat._id === player._id)
            ? [{ playerId: seat._id, held, maximum: rightsMaximum(held, game.pack, seat._id === player._id) }] : [];
    });
    if (!stock)
    {
        fail("Choose a tradable stock");
    }

    const rightsIssue = { insightId: card._id, stockKey: stock.key, actorPlayerId: player._id,
        period: game.currentPeriod, turn: game.turn, index: 0, offers };

    await context.db.insert("gameActions", { gameId: game._id, period: game.currentPeriod, turn: game.turn,
        actorPlayerId: player._id, action: { kind: "pass" }, rightsIssueId: card._id });
    await context.db.patch(card._id, { used: true, resolved: true });

    await feedItem(context, game, display.name, `opened a Rights Issue for ${stock.name}`, display.profileRoot, "");

    if (offers.length === 0)
    {
        await finishTurn(context, game, player, seats);
        await context.effects.enqueueNextNpc(game._id);

        return;
    }

    await context.db.patch(game._id, { rightsIssue });
    await advanceNpcRights(context, { ...game, rightsIssue }, purchase);
    await context.effects.enqueueNextNpc(game._id);
}

export function currentOffer(game: Document_<"games">, insightId: string, index: number)
{
    const issue = game.rightsIssue;
    if (!issue || issue.completed || game.status !== "playing" || issue.insightId !== insightId || issue.index !== index
      || issue.period !== game.currentPeriod || issue.turn !== game.turn)
    {
        fail("The Rights Issue decision has changed");
    }

    return issue;
}

export async function purchase(context: MutationContext, game: Document_<"games">, quantity: number)
{
    const issue = game.rightsIssue!;
    const offer = issue.offers[issue.index];
    const player = (await context.db.get(offer.playerId)) ?? fail("Player not found");
    const marketPrice = game.prices.find((price) => price.stockKey === issue.stockKey)?.value ?? 0;
    const unitPrice = rightsPriceFor(game.pack, marketPrice);
    const reason = rightsPurchaseError(quantity, offer.maximum, player.cash, game.pack, unitPrice);
    if (reason)
    {
        fail(reason);
    }

    const seats = await members(context, game._id);
    if (quantity > rightsAvailable(seats, issue.stockKey))
    {
        fail("There aren't enough shares available. Try fewer shares.");
    }

    const held = player.holdings.find((holding) => holding.stockKey === issue.stockKey)?.quantity ?? 0;
    const stock = (await gameStocks(context, game)).find((item) => item.key === issue.stockKey)!;
    const display = await publicIdentity(context, player);
    if (quantity > 0)
    {
        const roleBefore = companyRoles(seats, issue.stockKey).find((role) => role.playerId === player._id)?.role;
        const qualification = roleQualification(player, issue.stockKey, held + quantity,
            game.currentPeriod * 100 + game.turn + (issue.index + 1) / 100, roleBefore);

        const holdings = player.holdings.map((holding) => holding.stockKey === issue.stockKey
            ? { ...holding, quantity: held + quantity } : holding);
        const updated = { ...player, holdings, ...qualification,
            cash: roundMoney(player.cash - roundMoney(quantity * unitPrice)) };
        const roleAfter = companyRoles(seats.map((seat) => seat._id === player._id ? updated : seat), issue.stockKey)
            .find((role) => role.playerId === player._id)?.role;

        await context.db.patch(player._id, { holdings, ...qualification, cash: updated.cash });
        // Record the actual purchase price without creating another bargain.
        await context.db.insert("gameActions", { gameId: game._id, period: game.currentPeriod, turn: game.turn,
            actorPlayerId: player._id, action: { kind: "buy", stockKey: issue.stockKey, quantity },
            unitPrice, rightsIssueId: issue.insightId });
        await feedItem(context, game, display.name, `bought ${quantity} ${stock.name} shares in the Rights Issue`,
            display.profileRoot, "", { stockKey: issue.stockKey, quantity, roleBefore, roleAfter });
    }
    else
    {
        await feedItem(context, game, display.name, `skipped the ${stock.name} Rights Issue`, display.profileRoot, "grey");
    }

    const next = { ...issue, index: issue.index + 1,
        offers: issue.offers.map((item, index) => index === issue.index ? { ...item, purchased: quantity } : item) };
    if (next.index >= next.offers.length)
    {
        const completed = { ...next, index: issue.index, completed: true };

        await context.db.patch(game._id, { rightsIssue: completed });
        await context.effects.finishRightsLater({
            gameId: game._id, insightId: issue.insightId,
        });

        return { ...game, rightsIssue: completed };
    }

    await context.db.patch(game._id, { rightsIssue: next });

    return { ...game, rightsIssue: next };
}

export async function finishRights(context: MutationContext, gameId: Id<"games">, insightId: Id<"playerInsights">)
{
    const game = await context.db.get(gameId);
    const issue = game?.rightsIssue;
    if (!game || !issue?.completed || issue.insightId !== insightId
      || game.currentPeriod !== issue.period || game.turn !== issue.turn)
    {
        return;
    }

    const seats = await members(context, game._id);
    const actor = seats.find((seat) => seat._id === issue.actorPlayerId)!;

    await feedItem(context, game, "Rights Issue", "Rights Issue complete. Trading resumes.",
        "/static/imgs/icons/Stock.svg", "grey");
    await context.db.patch(game._id, { rightsIssue: undefined });
    await finishTurn(context, game, actor, seats);
    await context.effects.enqueueNextNpc(game._id);
}
