import type { MutationContext, Document_, Id } from "./model";
import { companyRoles, roleQualification, type CompanyRole } from "../shared/company-roles";
import { chanceStockKey, loanAmount } from "../shared/chance-cards";
import { transition, tradeError } from "../packages/game-contracts/src";
import { fail, feedItem, members } from "./library";
import { isCurrent } from "./seats";
import { debentureInHand } from "../shared/debenture";
import { debentureOffers } from "./debenture";
import { gameStock } from "./packRules";
import { marketFor } from "./legalActions";
export async function applyTurn(
    context: MutationContext,
    command: {
        playerId: Id<"players">;
        expectedPeriod: number;
        expectedTurn: number;
        action: Document_<"gameActions">["action"];
    },
    display: { name: string; profileRoot: string },
): Promise<void>
{
    let player = (await context.db.get(command.playerId)) ?? fail("Unknown player");
    const game = (await context.db.get(player.gameId)) ?? fail("No game found!");
    if (game.rightsIssue)
    {
        fail("Trading is paused during the Rights Issue");
    }

    if (game.status !== "playing" || !isCurrent(game, player))
    {
        fail("It is not your turn");
    }

    if (game.currentPeriod !== command.expectedPeriod || game.turn !== command.expectedTurn)
    {
        fail("The turn has changed; try again");
    }

    const players = await members(context, game._id);

    player = players.find((seat) => seat._id === player._id)!;
    const action = command.action;
    const market = marketFor(game, player, players);
    let message = "passed their go";
    let roleBefore: CompanyRole | undefined;
    let roleAfter: CompanyRole | undefined;
    let unitPrice: number | undefined;
    let debentureSale: { stockKey: number; quantity: number; debenturePayout: number } | undefined;
    if (action.kind === "government-loan")
    {
        const card = await context.db.get(action.insightId);
        if (!card || card.gameId !== game._id || card.playerId !== player._id
          || card.period !== game.currentPeriod || card.stockKey !== chanceStockKey
          || card.chanceKind !== "loan" || card.used)
        {
            fail("This Government Loan card cannot be used");
        }

        await context.db.patch(card._id, { used: true });
        await context.db.patch(player._id, { cash: player.cash + loanAmount(game.pack) });
        message = "received government bonus";
    }
    else if (action.kind === "debenture")
    {
        const card = await context.db.get(action.insightId);
        if (!card || card.gameId !== game._id || card.playerId !== player._id || card.stockKey !== chanceStockKey
          || card.chanceKind !== "debenture" || !debentureInHand(card, game.currentPeriod))
        {
            fail("This Debenture card cannot be used");
        }

        const offer = (await debentureOffers(context, game, player)).find((item) => item.stockKey === action.stockKey);
        if (!offer || offer.unavailableReason || offer.amount === null)
        {
            fail(offer?.unavailableReason ?? (game.pack === "tech" ? "Choose an eligible stock you own" : "Choose a bankrupt stock you own"));
        }

        const updated = { ...player, cash: player.cash + offer.amount,
            holdings: player.holdings.map((holding) => holding.stockKey === action.stockKey
                ? { ...holding, quantity: 0 } : holding),
            chairmanSince: (player.chairmanSince ?? []).filter((item) => item.stockKey !== action.stockKey),
            directorSince: (player.directorSince ?? []).filter((item) => item.stockKey !== action.stockKey) };

        roleBefore = companyRoles(players, action.stockKey).find((role) => role.playerId === player._id)?.role;
        roleAfter = companyRoles(players.map((seat) => seat._id === player._id ? updated : seat), action.stockKey)
            .find((role) => role.playerId === player._id)?.role;
        await context.db.patch(player._id, { cash: updated.cash, holdings: updated.holdings,
            chairmanSince: updated.chairmanSince, directorSince: updated.directorSince });
        await context.db.patch(card._id, { used: true });
        debentureSale = { stockKey: action.stockKey, quantity: -offer.quantity, debenturePayout: offer.amount };
        message = `Debenture sold at £${offer.amount.toLocaleString("en-GB")}`;
    }
    else if (action.kind !== "pass")
    {
        const stock = await gameStock(context, game, action.stockKey);
        if (!stock?.display)
        {
            fail("This stock cannot be traded");
        }

        const error = tradeError(market, action);
        if (error)
        {
            fail(error);
        }

        roleBefore = companyRoles(players, action.stockKey).find((role) => role.playerId === player._id)?.role;
        unitPrice = market.prices.find((price) => price.stockKey === action.stockKey)!.value;
        const updated = transition(market, action).players.find((seat) => seat.id === player._id)!;

        const after = updated.holdings.find((holding) => holding.stockKey === action.stockKey)?.quantity ?? 0;
        const qualification = roleQualification(player, action.stockKey, after,
            game.currentPeriod * 100 + game.turn, roleBefore);

        const updatedPlayer = { ...player, cash: updated.cash, holdings: [...updated.holdings], ...qualification };

        roleAfter = companyRoles(players.map((seat) => seat._id === player._id ? updatedPlayer : seat), action.stockKey)
            .find((role) => role.playerId === player._id)?.role;
        await context.db.patch(player._id, { cash: updated.cash, holdings: [...updated.holdings], ...qualification });
        message = `${action.kind === "buy" ? "bought" : "sold"} ${action.quantity} shares in ${stock.name}`;
    }

    await context.db.insert("gameActions", {
        gameId: game._id,
        period: game.currentPeriod,
        turn: game.turn,
        actorPlayerId: player._id,
        action, unitPrice,
    });
    const trade: Partial<Document_<"feed">> = {};
    if (action.kind === "government-loan")
    {
        trade.cashBonus = loanAmount(game.pack);
    }
    else if (action.kind === "debenture")
    {
        Object.assign(trade, debentureSale, { roleBefore, roleAfter });
    }
    else if (action.kind !== "pass")
    {
        Object.assign(trade, { stockKey: action.stockKey,
            quantity: action.quantity * (action.kind === "buy" ? 1 : -1), roleBefore, roleAfter });
    }

    await feedItem(context, game, display.name, message, display.profileRoot, "", trade);
    await finishTurn(context, game, player, players);
}

/** Consume the initiating bargain only; Rights Issue responses never advance trading. */
export async function finishTurn(context: MutationContext, game: Document_<"games">,
    player: Document_<"players">, players: Document_<"players">[])
{
    const next
        = players[(players.findIndex((seat) => seat._id === player._id) + 1) % players.length];
    const turn = game.turn + 1;

    await context.db.patch(game._id, {
        turn,
        currentPlayerId: next._id,
        currentUserId: next.userId,
        status: turn >= players.length * 3 ? "closed" : "playing",
    });
}
