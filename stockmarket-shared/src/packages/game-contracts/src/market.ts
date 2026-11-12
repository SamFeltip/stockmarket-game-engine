import { roundMoney, sharesAvailable, sharesForCash, validTradeQuantity } from "../../../shared/rules";
import type { Action, Market } from "./index";

export { roundMoney as money };

export function tradeError(market: Market, action: Action): string | undefined
{
    const self = market.players.find((seat) => seat.id === market.selfId);
    if (!self)
    {
        return "Unknown player";
    }

    if (action.kind === "pass")
    {
        return;
    }

    const price = market.prices.find((item) => item.stockKey === action.stockKey)?.value;
    const owned = self.holdings.find((item) => item.stockKey === action.stockKey)?.quantity;
    if (price === undefined || owned === undefined || !Number.isFinite(price) || price <= 0)
    {
        return "This stock cannot be traded";
    }

    if (!validTradeQuantity(action.quantity) || action.quantity <= 0)
    {
        return "Trade shares in steps of 1000";
    }

    const signed = action.kind === "buy" ? action.quantity : -action.quantity;
    const cost = roundMoney(signed * price);
    if (!Number.isFinite(cost))
    {
        return "This stock cannot be traded";
    }

    if (signed > sharesAvailable(market.players, action.stockKey, market.pack))
    {
        return "Not enough shares available";
    }

    if (owned + signed < 0)
    {
        return "Not enough shares to sell";
    }

    if (action.kind === "buy" && (!Number.isFinite(self.cash) || self.cash < cost))
    {
        return "Not enough cash";
    }
}

export function transition(market: Market, action: Action): Market
{
    const error = tradeError(market, action);
    if (error)
    {
        throw new Error(error);
    }

    if (action.kind === "pass")
    {
        return market;
    }

    const price = market.prices.find((item) => item.stockKey === action.stockKey)!.value;
    const signed = action.kind === "buy" ? action.quantity : -action.quantity;

    return {
        ...market,
        players: market.players.map((seat) =>
            seat.id === market.selfId
                ? {
                    ...seat,
                    cash: roundMoney(seat.cash - roundMoney(signed * price)),
                    holdings: seat.holdings.map((holding) =>
                        holding.stockKey === action.stockKey
                            ? { ...holding, quantity: holding.quantity + signed }
                            : holding,
                    ),
                }
                : seat,
        ),
    };
}

export function legalActions(market: Market): Action[]
{
    const actions: Action[] = [{ kind: "pass" }];
    const self = market.players.find((seat) => seat.id === market.selfId);
    if (!self)
    {
        return actions;
    }

    for (const { stockKey, value } of market.prices)
    {
        const owned = self.holdings.find((holding) => holding.stockKey === stockKey)?.quantity;
        if (owned === undefined || !Number.isFinite(value) || value <= 0)
        {
            continue;
        }

        const available = sharesAvailable(market.players, stockKey, market.pack);
        const buyLimit = Math.min(available, sharesForCash(self.cash, value));
        for (let quantity = 1000; quantity <= buyLimit; quantity += 1000)
        {
            actions.push({ kind: "buy", stockKey, quantity });
        }

        for (let quantity = 1000; quantity <= owned; quantity += 1000)
        {
            actions.push({ kind: "sell", stockKey, quantity });
        }
    }

    return actions;
}
