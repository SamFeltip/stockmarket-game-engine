import { tradingPrices } from "../shared/suspensions";
import { portfolioWorth } from "../shared/settlement";
import type { Document_ } from "./model";
import type { PublicSeat, Market } from "../packages/game-contracts/src";
export function publicSeats(
    players: readonly Document_<"players">[],
    game: Pick<Document_<"games">, "prices" | "tradingSuspensions">,
): PublicSeat[]
{
    const worth = (seat: Document_<"players">) => portfolioWorth(seat, tradingPrices(game, seat._id));
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
    return { pack: game.pack, selfId: player._id, prices: tradingPrices(game, player._id), players: publicSeats(players, game) };
}
