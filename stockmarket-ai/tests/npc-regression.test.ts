import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { GameEnvironment, npcAction, emptyMemory, roster } from "../src/index";
import type { NpcMemory } from "../src/index";

// Baselines include rights purchases rounded to trading lots. Hash every private decision view,
// action, returned memory and reason, plus final rewards. No wall-clock data.
const baselines = [
    { seed: 42, players: 4, periods: 6, steps: 83,
        hash: "8a0081e71ff1b0c3f14d649a89d3bd52d36dcc99d2cf557aa1409245a1dc95b6" },
    { seed: 718, players: 6, periods: 10, steps: 201,
        hash: "7bd370d5f2eab7fc8e8728ebb7b3e70273375c7f665da7a3f9ca73b0a2dd9e52" },
    { seed: 33, players: 5, periods: 7, steps: 120,
        hash: "3d5945b31fb2cfdb4df99025a0fd000789d50f53aaeb62c9dddf7bb789b154c4" },
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
