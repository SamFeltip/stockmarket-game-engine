import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { GameEnvironment, npcAction, emptyMemory, roster } from "../src/index";
import type { NpcMemory } from "../src/index";

// Hash the contents of every private decision view, action, returned memory and reason, plus final rewards.
// Normalize database IDs and object key order so setup inserts and object construction order do not affect the comparison.
const baselines = [
    { seed: 42, players: 4, periods: 6, steps: 85,
        hash: "624f7c362cf225d6789e47359d25f15711ec427de54edd910ff6a9f07e328d7c" },
    { seed: 718, players: 6, periods: 10, steps: 215,
        hash: "782e646f712056c56a0d42cdb996cea7c5ab588003cc560deda8b5cb46b376db" },
    { seed: 33, players: 5, periods: 7, steps: 121,
        hash: "bf1be7aaabd61f55b7325e7879985c4d108b9f93b4d36bae35ab6e21bdb2bbf5" },
];

for (const baseline of baselines) {
    void test(`preserves the ${baseline.players}-seat NPC game (seed ${baseline.seed})`, async () => {
        const { seed, players, periods } = baseline;
        const env = await GameEnvironment.create({ seed, players, periods });
        const memories = new Map<string, NpcMemory>();
        const hash = createHash("sha256");
        const gameSequence = Number(env.snapshot().gameId.split(":")[1]);
        const relativeId = (value: string) => value.replace(/([a-zA-Z]+):(\d{8})/g,
            (_id, table: string, sequence: string) => `${table}:${Number(sequence) - gameSequence}`);
        const serialize = (record: unknown) => JSON.stringify(record, (_key, value: unknown) => {
            if (typeof value === "string") {
                return relativeId(value);
            }
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const fields = value as Record<string, unknown>;
                return Object.fromEntries(Object.keys(fields).sort().map((key) => [key, fields[key]]));
            }
            return value;
        });
        let result = await env.current();
        let steps = 0;
        while (result.decision) {
            const decision = result.decision;
            const index = decision.observation.players.findIndex((seat) => seat.id === decision.playerId);
            const selected = npcAction(decision, { personality: roster[index % roster.length].id,
                difficulty: (["easy", "medium", "hard"] as const)[(index + seed) % 3] },
            memories.get(decision.playerId) ?? emptyMemory(), `${seed}:${steps}`);
            if (selected.action.kind === "rights-response") {
                assert.equal(selected.action.quantity % 1000, 0);
            }
            hash.update(serialize({ decision, selected }));
            result = await env.step(selected.action, decision.token);
            memories.set(decision.playerId, selected.nextMemory);
            steps++;
        }
        const rewards = Object.fromEntries(Object.entries(result.rewards).map(([id, reward]) => [relativeId(id), reward]));
        hash.update(serialize({ ...result, rewards }));
        assert.equal(steps, baseline.steps);
        assert.equal(hash.digest("hex"), baseline.hash);
    });
}
