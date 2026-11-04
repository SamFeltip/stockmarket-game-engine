import type { Decision, Holding, NpcAction, NpcMemory, NpcObservation, NpcProfile, ReasonCode, StockPrice } from "../../game-contracts/src";
import { decide, emptyMemory, isLegalProposal } from "./index";
import { engineVersion, tuningVersion } from "./difficulty";
import { roster } from "./roster";
import { random, shuffled } from "./random";
import { rightsPurchase, suspensionChoice } from "./chance";

type TradingInput = { readonly phase: "trading"; readonly observation: NpcObservation };
type RightsInput = { readonly phase: "rights"; readonly price: number; readonly maximum: number;
    readonly cash: number; readonly available: number };
type SuspensionInput = { readonly phase: "suspension" | "hold-stock"; readonly holdings: readonly Holding[];
    readonly opening: readonly StockPrice[]; readonly settled: readonly StockPrice[];
    readonly suspended: readonly number[] };
export type NpcActionInput = TradingInput | RightsInput | SuspensionInput;
type RightsAction = { kind: "rights-response"; quantity: number };
type SuspensionAction = { kind: "suspend" | "hold-stock"; stockKey?: number };
export type NpcPolicyAction = NpcAction | RightsAction | SuspensionAction;
interface ActionDecision<A = NpcPolicyAction> {
    action: A; nextMemory: NpcMemory; reason?: ReasonCode;
}

export function chooseNpcAction(input: TradingInput, profile: NpcProfile, memory: NpcMemory, seed: string): Decision;
export function chooseNpcAction(input: RightsInput): ActionDecision<RightsAction>;
export function chooseNpcAction(input: SuspensionInput): ActionDecision<SuspensionAction>;
export function chooseNpcAction(input: NpcActionInput, profile: NpcProfile, memory: NpcMemory, seed: string): ActionDecision;
/** The same phase-specific policy is used by live play and headless opponents. */
export function chooseNpcAction(input: NpcActionInput, profile?: NpcProfile,
    memory = emptyMemory(), seed = ""): ActionDecision {
    if (input.phase === "trading") {
        if (!profile) { throw new Error("Expected an NPC profile"); }
        return decide(input.observation, profile, memory, seed);
    }
    if (input.phase === "rights") {
        return { action: { kind: "rights-response",
            quantity: rightsPurchase(input.price, input.maximum, input.cash, input.available) }, nextMemory: memory };
    }
    return { action: { kind: input.phase === "suspension" ? "suspend" : "hold-stock",
        stockKey: suspensionChoice(input.holdings, input.opening, input.settled, input.suspended) }, nextMemory: memory };
}

/** Persistence envelope. Hosts store these fields without interpreting policy memory. */
export interface NpcState {
    readonly memory: string;
    readonly version: number;
}

export interface NpcVersions {
    readonly engineVersion: number;
    readonly tuningVersion: number;
}

export interface NpcTurnInput {
    readonly observation: NpcObservation;
    readonly profile: NpcProfile;
}

export interface NpcTurnDecision {
    readonly action: NpcAction;
    readonly state: NpcState;
    readonly reason: string;
    readonly engineVersion: number;
    readonly diagnostic?: string;
}

function encode(memory: NpcMemory): NpcState {
    return { memory: JSON.stringify(memory), version: 1 };
}

function decode(state: NpcState): NpcMemory {
    if (state.version !== 1) {
        throw new Error("Unsupported NPC memory version");
    }
    return JSON.parse(state.memory) as NpcMemory;
}

/** Keep validation outside the host's retry boundary, just as persistence reads are. */
export function prepareNpcState(saved: NpcState | null, reset = false): NpcState {
    return encode(!saved || reset ? emptyMemory() : decode(saved));
}

export function createNpcGameConfig(seed: string) {
    return { queue: shuffled(roster.map((entry) => entry.id), random(seed)), engineVersion, tuningVersion };
}

export function fallbackNpcTurn(state: NpcState): NpcTurnDecision {
    return { action: { kind: "pass" }, state, reason: "retain-cash", engineVersion };
}

/** All policy defaults, version compatibility and proposed-action checks belong here. */
export function decideNpcTurn(input: NpcTurnInput, state: NpcState, seed: string,
    versions: NpcVersions | null): NpcTurnDecision {
    if (versions?.engineVersion !== engineVersion || versions.tuningVersion !== tuningVersion) {
        throw new Error("Unsupported pinned engine version");
    }
    const decision = chooseNpcAction({ phase: "trading", observation: input.observation }, input.profile, decode(state), seed);
    if (!isLegalProposal(decision.action, [
        ...input.observation.legalActions,
        ...(input.observation.chanceOffers ?? []).map((offer) => offer.action),
    ])) {
        return { ...fallbackNpcTurn(state), diagnostic: "Invalid proposed action" };
    }
    return { action: decision.action, state: encode(decision.nextMemory), reason: decision.reason, engineVersion };
}
