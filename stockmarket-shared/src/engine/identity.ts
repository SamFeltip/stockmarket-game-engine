import type { QueryContext, Document_ } from "./model";
import { roster } from "../packages/npc-engine/src/roster";
export async function publicIdentity(context: QueryContext, seat: Document_<"players">)
{
    if (seat.controller?.kind === "npc")
    {
        const personality = seat.controller.personality;
        const entry = roster.find((item) => item.id === personality)!;

        return {
            name: entry.name,
            profileRoot: entry.portrait,
            tagline: entry.tagline,
            kind: "npc" as const,
        };
    }

    const account = seat.userId ? await context.db.get(seat.userId) : null;
    return { name: account?.name ?? "Unknown", profileRoot: account?.profileRoot ?? "", tagline: "", kind: "human" as const };
}
