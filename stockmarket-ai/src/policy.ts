import type { NpcMemory, NpcProfile, ReasonCode } from "../../stockmarket-shared/src/packages/game-contracts/src";
import { decide } from "../../stockmarket-shared/src/packages/npc-engine/src";
import { rightsPurchase, suspensionChoice } from "../../stockmarket-shared/src/packages/npc-engine/src/chance";
import type { AgentDecision, EnvironmentAction } from "./environment";

/** Optional existing-NPC baseline. Training code can supply any policy instead. */
export function npcAction(decision: AgentDecision, profile: NpcProfile, memory: NpcMemory, seed: string): {
    action: EnvironmentAction; nextMemory: NpcMemory; reason?: ReasonCode;
} {
    if (decision.phase === "trading") {
        const result = decide(decision.observation, profile, memory, seed);
        return { action: result.action, nextMemory: result.nextMemory, reason: result.reason };
    }
    const self = decision.observation.players.find((player) => player.id === decision.playerId)!;
    if (decision.phase === "rights") {
        const price = decision.observation.prices.find((item) => item.stockKey === decision.stockKey)!.value;
        return { action: { kind: "rights-response", quantity: rightsPurchase(price, decision.maximum, self.cash, decision.available) },
            nextMemory: memory };
    }
    return { action: { kind: decision.phase === "suspension" ? "suspend" : "hold-stock",
        stockKey: suspensionChoice(self.holdings, decision.observation.prices, decision.settledPrices,
            decision.observation.prices.filter((price) => !decision.choices.includes(price.stockKey)).map((price) => price.stockKey)) },
        nextMemory: memory };
}
