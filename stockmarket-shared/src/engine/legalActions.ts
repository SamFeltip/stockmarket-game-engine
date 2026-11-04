import type { Document_ } from "./model";
import type { PublicSeat, Market } from "../packages/game-contracts/src";
export function publicSeats(
    players: readonly Document_<"players">[],
    prices: Document_<"games">["prices"],
): PublicSeat[]
{
    const worth = (seat: Document_<"players">) =>
        seat.cash
        + seat.holdings.reduce(
            (sum, item) =>
                sum
                + item.quantity
                * (prices.find((price) => price.stockKey === item.stockKey)?.value ?? 0),
            0,
        );
    const ranked = players.toSorted((a, b) => worth(b) - worth(a));

    return players.map((seat) => ({
        id: seat._id,
        cash: seat.cash,
        holdings: seat.holdings,
        ranking: ranked.findIndex((item) => item._id === seat._id) + 1,
        periodStartRanking: seat.periodStartRanking ?? 1,
    }));
}

export function marketFor(
    game: Document_<"games">,
    player: Document_<"players">,
    players: readonly Document_<"players">[],
): Market
{
    return { selfId: player._id, prices: game.prices, players: publicSeats(players, game.prices) };
}
