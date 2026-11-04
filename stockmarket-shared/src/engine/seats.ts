import type { Document_ } from "./model";
export function isNpc(seat: Document_<"players">): boolean
{
    return seat.controller?.kind === "npc";
}

export function isCurrent(game: Document_<"games">, seat: Document_<"players">): boolean
{
    return game.currentPlayerId
        ? game.currentPlayerId === seat._id
        : !!seat.userId && game.currentUserId === seat.userId;
}
