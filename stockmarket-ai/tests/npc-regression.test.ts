import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { GameEnvironment, npcAction, emptyMemory, roster } from "../src/index";
import type { NpcMemory } from "../src/index";

// Baselines include lot-rounded Rights Issues and two-period Debenture expiry. Hash every private decision view,
// action, returned memory and reason, plus final rewards. Normalize database IDs relative to the game so setup inserts do not affect the comparison.
const baselines = [
    { seed: 42, players: 4, periods: 6, steps: 85,
        hash: "0ff07afdf310f9d7daee5612d92bf4c3b8e99fd331066d494a094cd1a57d3ede" },
    { seed: 718, players: 6, periods: 10, steps: 215,
        hash: "ef60e074e1d05e7b717370d4c8409d396ca85b5c209067322efb2236180fc461" },
    { seed: 33, players: 5, periods: 7, steps: 121,
        hash: "bba44ad8fcc28afaa3d8341ccba4ea55e77407b52973afab6edba8435ded0ee8" },
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
        const replaceId = (_key: string, value: unknown) => typeof value === "string" ? relativeId(value) : value;
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
            hash.update(JSON.stringify({ decision, selected }, replaceId));
            result = await env.step(selected.action, decision.token);
            memories.set(decision.playerId, selected.nextMemory);
            steps++;
        }
        const rewards = Object.fromEntries(Object.entries(result.rewards).map(([id, reward]) => [relativeId(id), reward]));
        hash.update(JSON.stringify({ ...result, rewards }));
        assert.equal(steps, baseline.steps);
        assert.equal(hash.digest("hex"), baseline.hash);
    });
}
