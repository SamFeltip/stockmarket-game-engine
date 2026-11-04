import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { GameEnvironment, npcAction, emptyMemory, roster } from "../src/index";
import type { NpcMemory } from "../src/index";

// Captured before the host/policy separation: hash every private decision view,
// action, returned memory and reason, plus final rewards. No wall-clock data.
const baselines = [
    { seed: 42, players: 4, periods: 6, steps: 83,
        hash: "8a0a92a60ba38a67875cdcfdd255a068b035994527f353b26b65a27c52d85be7" },
    { seed: 718, players: 6, periods: 10, steps: 200,
        hash: "73c8da317be8f38e9950fc1bbe4e1dfa3a76e117dda945c9242f00af9e3e1218" },
    { seed: 33, players: 5, periods: 7, steps: 123,
        hash: "2969a0d9a8a69eee89a1f6cb529cb1fa1bca58505567686500a2001592e05c66" },
];

for (const baseline of baselines) {
    void test(`preserves the pre-refactor ${baseline.players}-seat NPC game (seed ${baseline.seed})`, async () => {
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
