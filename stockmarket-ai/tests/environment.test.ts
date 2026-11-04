import { test } from "node:test";
import assert from "node:assert/strict";
import { GameEnvironment, npcAction, emptyMemory, roster } from "../src/index";
import type { NpcMemory, EnvironmentSnapshot } from "../src/index";
import type { Document_ } from "../../stockmarket-shared/src/engine/model";
import { sharesPerCompany } from "../../stockmarket-shared/src/shared/rules";
import { chanceStockKey } from "../../stockmarket-shared/src/shared/chance-cards";

function rows<T extends "games" | "players" | "playerInsights">(snapshot: EnvironmentSnapshot, table: T): Document_<T>[] {
    const ids = new Set(snapshot.store.tables.filter(([, name]) => name === table).map(([id]) => id));
    return snapshot.store.rows.filter((row) => ids.has(row._id)) as unknown as Document_<T>[];
}

for (const players of [4, 6]) {
    test(`plays complete ${players}-seat games with the shared NPCs and full retail rules`, async () => {
        const env = await GameEnvironment.create({ seed: 718, players, periods: players === 4 ? 6 : 10 });
        const memories = new Map<string, NpcMemory>();
        let result = await env.current();
        let steps = 0;
        const phases = new Set<string>();
        while (result.decision) {
            const decision = result.decision;
            phases.add(decision.phase);
            const index = decision.observation.players.findIndex((seat) => seat.id === decision.playerId);
            const selected = npcAction(decision, { personality: roster[index % roster.length].id, difficulty: "medium" },
                memories.get(decision.playerId) ?? emptyMemory(), `${718}:${decision.token}`);
            result = await env.step(selected.action, decision.token);
            memories.set(decision.playerId, selected.nextMemory);
            assert.ok(++steps < 1000, "game must make progress");
        }
        assert.equal(result.finished, true);
        assert.ok(Object.values(result.rewards).every(Number.isFinite));
        assert.ok(phases.has("suspension"));
        const final = env.snapshot();
        assert.equal(rows(final, "games")[0].status, "finished");
        const seats = rows(final, "players");
        for (const seat of seats) {
            assert.ok(seat.cash >= 0);
            for (const holding of seat.holdings) { assert.ok(holding.quantity >= 0); }
        }
        for (const holding of seats[0].holdings) {
            assert.ok(seats.reduce((total, seat) => total + seat.holdings.find((item) => item.stockKey === holding.stockKey)!.quantity, 0)
                <= sharesPerCompany);
        }
    });
}

test("seeded reset and checkpoint branching replay exactly", async () => {
    const first = await GameEnvironment.create({ seed: 42 });
    const second = await GameEnvironment.create({ seed: 42 });
    assert.deepEqual(first.snapshot(), second.snapshot());
    const branch = GameEnvironment.fromSnapshot(first.snapshot());
    for (let index = 0; index < 80; index++) {
        const before = await first.current();
        if (!before.decision) { break; }
        const action = before.decision.phase === "trading" ? { kind: "pass" as const }
            : before.decision.phase === "rights" ? { kind: "rights-response" as const, quantity: 0 }
                : { kind: "suspend" as const };
        assert.deepEqual(await first.step(action, before.decision.token), await branch.step(action, before.decision.token));
    }
    assert.deepEqual(first.snapshot(), branch.snapshot());
    const different = await GameEnvironment.create({ seed: 43 });
    assert.notDeepEqual(second.snapshot(), different.snapshot());
});

test("rejected and stale actions leave all state and randomness unchanged", async () => {
    const env = await GameEnvironment.create({ seed: 1 });
    const decision = (await env.current()).decision!;
    const before = env.snapshot();
    await assert.rejects(env.step({ kind: "buy", stockKey: decision.observation.prices[0].stockKey, quantity: 999 }, decision.token));
    assert.deepEqual(env.snapshot(), before);
    await assert.rejects(env.step({ kind: "rights-response", quantity: 0 }, decision.token));
    assert.deepEqual(env.snapshot(), before);
    await env.step({ kind: "pass" }, decision.token);
    const advanced = env.snapshot();
    await assert.rejects(env.step({ kind: "pass" }, decision.token));
    assert.deepEqual(env.snapshot(), advanced);
});

test("loan and Rights Issue use the shared commands, pause trading and consume exactly one turn", async () => {
    const original = await GameEnvironment.create({ seed: 7 });
    const fixture = original.snapshot();
    const game = rows(fixture, "games")[0];
    const seats = rows(fixture, "players");
    const player = seats.find((seat) => seat._id === game.currentPlayerId)!;
    const stockKey = game.prices[0].stockKey;
    player.holdings.find((holding) => holding.stockKey === stockKey)!.quantity = 1000;
    const cards = rows(fixture, "playerInsights");
    const loan = cards.find((card) => card.playerId === player._id)!;
    Object.assign(loan, { stockKey: chanceStockKey, chanceKind: "loan", used: false, resolved: false });
    const rights = cards.filter((card) => card.playerId === player._id)[1];
    Object.assign(rights, { stockKey: chanceStockKey, chanceKind: "rights", used: false, resolved: false });
    const env = GameEnvironment.fromSnapshot(fixture);
    const current = (await env.current()).decision!;
    await env.step({ kind: "rights-issue", insightId: rights._id, stockKey }, current.token);
    const offer = (await env.current()).decision!;
    assert.equal(offer.phase, "rights");
    const unchangedTurn = rows(env.snapshot(), "games")[0].turn;
    assert.equal(unchangedTurn, 0);
    await env.step({ kind: "rights-response", quantity: 500 }, offer.token);
    assert.equal(rows(env.snapshot(), "games")[0].turn, 1);
    assert.equal(rows(env.snapshot(), "players").find((seat) => seat._id === player._id)!.cash, 59_500);
    // Bring the first player back to its next normal turn.
    for (let index = 1; index < seats.length; index++) {
        const turn = (await env.current()).decision!;
        await env.step({ kind: "pass" }, turn.token);
    }
    const turn = (await env.current()).decision!;
    await env.step({ kind: "government-loan", insightId: loan._id }, turn.token);
    assert.equal(rows(env.snapshot(), "players").find((seat) => seat._id === player._id)!.cash, 69_500);
});

test("observations expose own cards but not the full hidden state", async () => {
    const env = await GameEnvironment.create({ seed: 33 });
    const { decision } = await env.current();
    assert.equal(decision!.observation.ownInsights.length, 10);
    assert.equal("hands" in decision!.observation, false);
    assert.equal("rows" in decision!.observation, false);
    const ids = rows(env.snapshot(), "playerInsights").filter((card) => card.playerId === decision!.playerId)
        .map((card) => card.catalogCardId);
    assert.deepEqual(decision!.observation.ownInsights.map((card) => card.id), ids);
});

test("invalid configurations fail before a game starts", async () => {
    for (const config of [{ seed: 1, players: 3 }, { seed: 1, periods: 2 }, { seed: NaN }]) {
        await assert.rejects(GameEnvironment.create(config));
    }
});
