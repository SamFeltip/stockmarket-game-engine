/** Public host boundary: no host needs to import strategy, memory or tuning modules. */
import type { QueryContext, Document_ } from "./engine/model";
import type { NpcTurnInput } from "./packages/npc-engine/src/runtime";
import { buildNpcObservation } from "./engine/observation";

export { createNpcGameConfig, prepareNpcState, fallbackNpcTurn, decideNpcTurn, chooseNpcAction } from "./packages/npc-engine/src/runtime";
export type { NpcState, NpcVersions, NpcTurnInput, NpcTurnDecision } from "./packages/npc-engine/src/runtime";
export { roster, npcDifficulties } from "./npc-catalog";

export async function buildNpcTurnInput(context: QueryContext, game: Document_<"games">,
    seat: Document_<"players">): Promise<NpcTurnInput> {
    if (seat.controller?.kind !== "npc") {
        throw new Error("Expected an NPC seat");
    }
    return {
        observation: await buildNpcObservation(context, game, seat),
        profile: { personality: seat.controller.personality,
            difficulty: seat.npcDifficulty ?? game.npcDifficulty ?? "medium" },
    };
}
