import type { Document_ } from "./model";

// Older web spectator games recorded only a seat-free host. Keep those games controllable.
export function spectatorHost(game: Document_<"games">, seats: Pick<Document_<"players">, "userId">[])
{
    return game.spectatorHostId ?? (!game.tvTokenHash && game.hostId
      && !seats.some((seat) => seat.userId === game.hostId) ? game.hostId : undefined);
}

export function phoneHost(game: Document_<"games">, seats: Pick<Document_<"players">, "userId">[])
{
    const displayHost = spectatorHost(game, seats);

    return displayHost && game.hostId === displayHost
        ? seats.find((seat) => seat.userId)?.userId ?? game.hostId : game.hostId;
}
