import type { Document_, Id, MutationContext } from "../../stockmarket-shared/src/engine/model";
import type { NpcAction, NpcObservation } from "../../stockmarket-shared/src/packages/game-contracts/src";
import { startingCash, minimumPlayers, maximumPlayers, validGameLength } from "../../stockmarket-shared/src/shared/rules";
import { members, seedCatalog, roundInsights, GameError } from "../../stockmarket-shared/src/engine/library";
import { launchGame } from "../../stockmarket-shared/src/engine/launch";
import { applyTurn } from "../../stockmarket-shared/src/engine/commands";
import { advancePeriod } from "../../stockmarket-shared/src/engine/advancePeriod";
import { activateRightsIssue, currentOffer, purchase, finishRights } from "../../stockmarket-shared/src/engine/rightsIssue";
import { currentSuspension, holdStock } from "../../stockmarket-shared/src/engine/rounds";
import { spendSuspension } from "../../stockmarket-shared/src/engine/suspensions";
import { buildNpcObservation } from "../../stockmarket-shared/src/engine/observation";
import { publicSeats } from "../../stockmarket-shared/src/engine/legalActions";
import { pendingSuspensions } from "../../stockmarket-shared/src/shared/suspensions";
import { rightsAvailable, rightsIssuePrice } from "../../stockmarket-shared/src/shared/rights-issue";
import { roundPrices, portfolioWorth } from "../../stockmarket-shared/src/shared/settlement";
import { withRoleBonuses } from "../../stockmarket-shared/src/shared/company-roles";
import { MemoryStore } from "./store";
import type { StoreSnapshot } from "./store";
import { SeededRandom } from "./random";

export interface EnvironmentConfig { seed: number; players?: number; periods?: number }
export type EnvironmentAction = NpcAction | { kind: "rights-response"; quantity: number }
    | { kind: "suspend"; stockKey?: number } | { kind: "hold-stock"; stockKey?: number };
export interface OwnCard {
    id: string; stockKey: number; value: number; period: number;
    chanceKind?: Document_<"playerInsights">["chanceKind"]; used: boolean; resolved: boolean;
}
interface View { playerId: Id<"players">; token: string; observation: NpcObservation; ownCards: OwnCard[] }
export type AgentDecision =
    | (View & { phase: "trading" })
    | (View & { phase: "rights"; maximum: number; available: number; unitPrice: number; stockKey: number })
    | (View & { phase: "suspension" | "hold-stock"; choices: number[]; settledPrices: { stockKey: number; value: number }[] });
export interface StepResult {
    decision: AgentDecision | null;
    finished: boolean;
    // Terminal wealth rewards only. Callers may define their own training objective outside the rules.
    rewards: Record<string, number>;
}
export interface EnvironmentSnapshot { store: StoreSnapshot; randomState: number; gameId: Id<"games"> }

/** No network, database service, rendering, wall clock, or presentation delays. */
export class GameEnvironment {
    private store = new MemoryStore();
    private random: SeededRandom;
    private gameId!: Id<"games">;
    private runtime: MutationContext;
    private busy = false;

    private constructor(seed: number) {
        this.random = new SeededRandom(seed);
        this.runtime = {
            db: this.store,
            random: () => this.random.next(),
            // Agents are controlled explicitly by the caller. Presentation callbacks are consumed by prepare().
            effects: { enqueueNextNpc: async () => {}, finishRightsLater: async () => {} },
        };
    }
    static async create(config: EnvironmentConfig): Promise<GameEnvironment> {
        const count = config.players ?? minimumPlayers;
        const periods = config.periods ?? 6;
        if (!Number.isSafeInteger(count) || count < minimumPlayers || count > maximumPlayers) {
            throw new GameError("Invalid player roster");
        }
        if (!Number.isSafeInteger(periods) || !validGameLength(periods - 1)) {
            throw new GameError("Invalid game length");
        }
        if (!Number.isSafeInteger(config.seed)) { throw new GameError("Seed must be a safe integer"); }
        const env = new GameEnvironment(config.seed);
        await seedCatalog(env.runtime);
        const stocks = (await env.store.query("stocks").collect()).filter((stock) => stock.display);
        const prices = stocks.map((stock) => ({ stockKey: stock.key, value: stock.startingValue }));
        const hostId = await env.store.insert("users", { name: "Agent 0", profileRoot: "" });
        env.gameId = await env.store.insert("games", {
            code: "training", hostId, currentUserId: hostId, periodCount: periods - 1,
            currentPeriod: 0, turn: 0, status: "waiting", suspended: [], rulesVersion: 2,
            npcDifficulty: "medium", rosterRevision: 0, prices, priceHistory: [{ period: 0, prices }],
        });
        for (let index = 0; index < count; index++) {
            const userId = index === 0 ? hostId
                : await env.store.insert("users", { name: `Agent ${index}`, profileRoot: "" });
            await env.store.insert("players", {
                gameId: env.gameId, userId, controller: { kind: "human", userId },
                seatOrder: index, active: true, cash: startingCash,
                holdings: prices.map((price) => ({ stockKey: price.stockKey, quantity: 0 })),
            });
        }
        await launchGame(env.runtime, await env.game());
        return env;
    }
    /** Privileged debugging/checkpoint API: never pass this snapshot to a policy. */
    snapshot(): EnvironmentSnapshot {
        if (this.busy) { throw new Error("Cannot snapshot during a step"); }
        return { store: this.store.snapshot(), randomState: this.random.state, gameId: this.gameId };
    }
    static fromSnapshot(snapshot: EnvironmentSnapshot): GameEnvironment {
        const env = new GameEnvironment(snapshot.randomState);
        env.store.restore(snapshot.store);
        env.gameId = snapshot.gameId;
        return env;
    }
    private async game(): Promise<Document_<"games">> {
        const game = await this.store.get(this.gameId);
        if (!game) { throw new Error("Missing environment game"); }
        return game;
    }
    private async atomic<T>(operation: () => Promise<T>): Promise<T> {
        if (this.busy) { throw new Error("Concurrent environment operations are not supported"); }
        this.busy = true;
        this.store.begin();
        const randomState = this.random.state;
        try {
            const result = await operation();
            this.store.commit();
            return result;
        } catch (error) {
            this.store.rollback();
            this.random.state = randomState;
            throw error;
        } finally { this.busy = false; }
    }
    /** Resolve presentation-only boundaries immediately, stopping at the next player decision. */
    private async prepare(): Promise<AgentDecision | null> {
        for (;;) {
            const game = await this.game();
            const players = await members(this.runtime, this.gameId);
            if (game.status === "finished") { return null; }
            const issue = game.rightsIssue;
            if (issue?.completed) {
                await finishRights(this.runtime, this.gameId, issue.insightId);
                continue;
            }
            let playerId = game.currentPlayerId!;
            let phase: AgentDecision["phase"] = "trading";
            let cardId = "";
            const insights = await roundInsights(this.runtime, game);
            const stocks = await this.store.query("stocks").collect();
            if (issue) { playerId = issue.offers[issue.index].playerId; phase = "rights"; cardId = issue.insightId; }
            else if (game.status === "closed" || game.status === "special_insights") {
                const holdKeys = new Set(stocks.filter((stock) => stock.name === "Hold Stock Price").map((stock) => stock.key));
                const legacyHold = insights.find((card) => holdKeys.has(card.stockKey) && !card.resolved);
                const suspension = pendingSuspensions(game.currentPeriod, players, insights)[0];
                if (legacyHold) { playerId = legacyHold.playerId; phase = "hold-stock"; cardId = legacyHold._id; }
                else if (suspension) {
                    await this.store.patch(this.gameId, { suspensionPeriod: game.currentPeriod });
                    playerId = suspension.playerId; phase = "suspension"; cardId = suspension._id;
                } else { await advancePeriod(this.runtime, game, game.currentPeriod); continue; }
            }
            const player = players.find((seat) => seat._id === playerId)!;
            const observation = await buildNpcObservation(this.runtime, game, player);
            const token = `${game.currentPeriod}:${game.turn}:${phase}:${cardId}:${issue?.index ?? 0}`;
            const hand = await this.store.query("playerInsights").withIndex("by_player_period", (query) =>
                query.eq("playerId", playerId)).collect();
            const ownCards = hand.map((card) => ({ id: card._id, stockKey: card.stockKey, value: card.value,
                period: card.period, chanceKind: card.chanceKind, used: card.used ?? false, resolved: card.resolved }));
            const view = { playerId, token, observation, ownCards };
            if (phase === "rights") {
                return { ...view, phase, maximum: issue!.offers[issue!.index].maximum,
                    available: rightsAvailable(players, issue!.stockKey), unitPrice: rightsIssuePrice, stockKey: issue!.stockKey };
            }
            if (phase === "suspension" || phase === "hold-stock") {
                return { ...view, phase, choices: stocks.filter((stock) => stock.display
                    && (phase === "hold-stock" || !game.suspended.includes(stock.key))).map((stock) => stock.key),
                    settledPrices: roundPrices(game.prices, withRoleBonuses(insights, players, stocks), stocks, game.suspended) };
            }
            return { ...view, phase: "trading" };
        }
    }
    private async result(): Promise<StepResult> {
        const decision = await this.prepare();
        const game = await this.game();
        const players = await members(this.runtime, this.gameId);
        return { decision, finished: decision === null,
            rewards: Object.fromEntries(players.map((player) => [player._id,
                decision === null ? portfolioWorth(player, game.prices) : 0])) };
    }
    async current(): Promise<StepResult> { return this.atomic(() => this.result()); }
    async step(action: EnvironmentAction, expectedToken: string): Promise<StepResult> {
        return this.atomic(async () => {
            const decision = await this.prepare();
            if (!decision) { throw new GameError("The game is finished"); }
            if (decision.token !== expectedToken) { throw new GameError("The turn has changed; try again"); }
            const game = await this.game();
            const player = (await this.store.get(decision.playerId))!;
            if (decision.phase === "rights" && action.kind === "rights-response") {
                currentOffer(game, game.rightsIssue!.insightId, game.rightsIssue!.index);
                await purchase(this.runtime, game, action.quantity);
            } else if (decision.phase === "suspension" && action.kind === "suspend") {
                const insights = await roundInsights(this.runtime, game);
                const card = pendingSuspensions(game.currentPeriod, await members(this.runtime, this.gameId), insights)[0];
                await currentSuspension(this.runtime, game, card._id);
                await spendSuspension(this.runtime, game, card, action.stockKey);
            } else if (decision.phase === "hold-stock" && action.kind === "hold-stock") {
                const insights = await roundInsights(this.runtime, game);
                const stocks = await this.store.query("stocks").collect();
                const card = insights.find((item) => !item.resolved && stocks.some((stock) =>
                    stock.key === item.stockKey && stock.name === "Hold Stock Price"))!;
                await holdStock(this.runtime, game, player, card._id, action.stockKey);
            } else if (decision.phase === "trading" && action.kind !== "rights-response"
                && action.kind !== "suspend" && action.kind !== "hold-stock") {
                const command = { expectedPeriod: game.currentPeriod, expectedTurn: game.turn, playerId: player._id };
                const display = { name: (await this.store.get(player.userId!))!.name, profileRoot: "" };
                if (action.kind === "rights-issue") {
                    await activateRightsIssue(this.runtime, game, player, display,
                        { ...command, ...action, insightId: action.insightId as Id<"playerInsights"> });
                } else {
                    const accepted = action.kind === "government-loan" || action.kind === "debenture"
                        ? { ...action, insightId: action.insightId as Id<"playerInsights"> } : action;
                    await applyTurn(this.runtime, { ...command, action: accepted }, display);
                }
            } else { throw new GameError("Action does not match the current decision phase"); }
            return this.result();
        });
    }
    async standings() {
        return this.atomic(async () => {
            const game = await this.game();
            return publicSeats(await members(this.runtime, this.gameId), game.prices);
        });
    }
}
