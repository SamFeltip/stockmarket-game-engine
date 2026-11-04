import { sharesPerCompany, validTradeQuantity } from "../../../shared/rules";
import type { Action, Market } from "./index";

export function money(value: number): number
{
    return Math.round(value * 100) / 100;
}

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
    const cost = money(signed * price);
    const available
        = sharesPerCompany
          - market.players.reduce(
              (sum, seat) =>
                  sum
                  + (seat.holdings.find((item) => item.stockKey === action.stockKey)?.quantity ?? 0),
              0,
          );
    if (!Number.isFinite(cost))
    {
        return "This stock cannot be traded";
    }

    if (signed > available)
    {
        return "Not enough shares available";
    }

    if (owned + signed < 0)
    {
        return "Not enough shares to sell";
    }

    if (self.cash < cost)
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
                    cash: money(seat.cash - money(signed * price)),
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
    const sizes = Array.from({ length: sharesPerCompany / 1000 }, (_, index) => (index + 1) * 1000);
    for (const price of market.prices)
    {
        for (const kind of ["buy", "sell"] as const)
        {
            for (const quantity of sizes)
            {
                const action = { kind, stockKey: price.stockKey, quantity };
                if (!tradeError(market, action))
                {
                    actions.push(action);
                }
            }
        }
    }

    return actions;
}
