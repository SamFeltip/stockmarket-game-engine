import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { GameEnvironment, npcAction, emptyMemory, roster } from "../src/index";
import type { NpcMemory } from "../src/index";

// Baselines include lot-rounded Rights Issues and two-period Debenture expiry. Hash every private decision view,
// action, returned memory and reason, plus final rewards. No wall-clock data.
const baselines = [
    { seed: 42, players: 4, periods: 6, steps: 85,
        hash: "da871a987228fe99c7fbe8795eade819166149c88ec9d56aa464082ea33ae3f1" },
    { seed: 718, players: 6, periods: 10, steps: 208,
        hash: "e1f447599598b220bfbcebd5efdf5875b7a5a5c7e8475bb2f7eaedbbefa6bdcf" },
    { seed: 33, players: 5, periods: 7, steps: 121,
        hash: "8eba2d96600202cd1e10e76086c28d09f929c5d9c67fb90ad723c7a6103fdfea" },
];

for (const baseline of baselines) {
    void test(`preserves the ${baseline.players}-seat NPC game (seed ${baseline.seed})`, async () => {
        const { seed, players, periods } = baseline;
        const env = await GameEnvironment.create({ seed, players, periods });
        const memories = new Map<string, NpcMemory>();
        const hash = createHash("sha256");
        let result = await env.current();
        let steps = 0;
        while (result.decision) {
            const decision = result.decision;
            const index = decision.observation.players.findIndex((seat) => seat.id === decision.playerId);
            const selected = npcAction(decision, { personality: roster[index % roster.length].id,
                difficulty: (["easy", "medium", "hard"] as const)[(index + seed) % 3] },
            memories.get(decision.playerId) ?? emptyMemory(), `${seed}:${decision.token}`);
            if (selected.action.kind === "rights-response") {
                assert.equal(selected.action.quantity % 1000, 0);
            }
            hash.update(JSON.stringify({ decision, selected }));
            result = await env.step(selected.action, decision.token);
            memories.set(decision.playerId, selected.nextMemory);
            steps++;
        }
        hash.update(JSON.stringify(result));
        assert.equal(steps, baseline.steps);
        assert.equal(hash.digest("hex"), baseline.hash);
    });
}
