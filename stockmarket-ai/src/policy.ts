import type { NpcMemory, NpcProfile, ReasonCode } from "../../stockmarket-shared/src/packages/game-contracts/src";
import { chooseNpcAction } from "../../stockmarket-shared/src/packages/npc-engine/src/runtime";
import type { AgentDecision, EnvironmentAction } from "./environment";

/** Optional existing-NPC baseline. Training code can supply any policy instead. */
export function npcAction(decision: AgentDecision, profile: NpcProfile, memory: NpcMemory, seed: string): {
    action: EnvironmentAction; nextMemory: NpcMemory; reason?: ReasonCode;
} {
    if (decision.phase === "trading") {
        const result = chooseNpcAction(decision, profile, memory, seed);
        return { action: result.action, nextMemory: result.nextMemory, reason: result.reason };
    }
    const self = decision.observation.players.find((player) => player.id === decision.playerId)!;
    if (decision.phase === "rights") {
        const price = decision.observation.prices.find((item) => item.stockKey === decision.stockKey)!.value;
        return chooseNpcAction({ phase: "rights", price, maximum: decision.maximum,
            cash: self.cash, available: decision.available }, profile, memory, seed);
    }
    return chooseNpcAction({ phase: decision.phase, holdings: self.holdings,
        opening: decision.observation.prices, settled: decision.settledPrices,
        suspended: decision.observation.prices.filter((price) => !decision.choices.includes(price.stockKey))
            .map((price) => price.stockKey) }, profile, memory, seed);
}
