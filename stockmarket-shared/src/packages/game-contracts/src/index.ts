export type Difficulty = "easy" | "medium" | "hard";

export type PersonalityId = "frankie" | "casey" | "ada" | "felix" | "morgan";

export type Action
    = | { readonly kind: "pass" }
      | {
          readonly kind: "buy" | "sell";
          readonly stockKey: number;
          readonly quantity: number;
      };

export type ChanceAction
    = | { readonly kind: "government-loan"; readonly insightId: string }
      | { readonly kind: "debenture"; readonly insightId: string; readonly stockKey: number }
      | { readonly kind: "rights-issue"; readonly insightId: string; readonly stockKey: number };

export type NpcAction = Action | ChanceAction;

export interface ChanceOffer {
    readonly action: ChanceAction;
    readonly amount: number;
}

export interface Holding {
    readonly stockKey: number;
    readonly quantity: number;
}

export interface StockPrice {
    readonly stockKey: number;
    readonly value: number;
}

export interface PublicSeat {
    readonly id: string;
    readonly cash: number;
    readonly holdings: readonly Holding[];
    readonly ranking: number;
    readonly periodStartRanking: number;
}

export interface PublicCatalogCard {
    readonly id: string;
    readonly stockKey: number;
    readonly value: number;
}

export type OwnInsight = PublicCatalogCard;

export interface PublicActionEvent {
    readonly period: number;
    readonly turn: number;
    readonly actorPlayerId: string;
    readonly action: Action;
}

export interface PublicPeriodSummary {
    readonly period: number;
    readonly opening: readonly StockPrice[];
    readonly settled: readonly StockPrice[];
}

export interface Market {
    readonly selfId: string;
    readonly players: readonly PublicSeat[];
    readonly prices: readonly StockPrice[];
}

export interface NpcObservation extends Market {
    readonly period: number;
    readonly finalPeriod: number;
    readonly turn: number;
    readonly actionsRemaining: 1 | 2 | 3;
    readonly ownInsights: readonly OwnInsight[];
    readonly catalog: readonly PublicCatalogCard[];
    readonly events: readonly PublicActionEvent[];
    readonly settledPeriods: readonly PublicPeriodSummary[];
    readonly legalActions: readonly Action[];
    readonly remainingSeatOrder: readonly string[];
    readonly favouriteStockKey: number;
    readonly chanceOffers?: readonly ChanceOffer[];
}

export interface NpcProfile {
    readonly personality: PersonalityId;
    readonly difficulty: Difficulty;
}

export interface Credibility {
    readonly playerId: string;
    readonly stockKey: number;
    readonly scores: readonly number[];
}

export interface NpcMemory {
    readonly version: 1;
    readonly settledThrough: number;
    readonly credibility: readonly Credibility[];
    readonly leaderPeriod?: number;
    readonly leaderId?: string;
    readonly bait?: {
        readonly period: number;
        readonly turn: number;
        readonly stockKey: number;
        readonly quantity: number;
    };
    readonly followers: readonly { readonly playerId: string; readonly responses: number }[];
    readonly observedThrough: string;
}

export type ReasonCode
    = "loyalty" | "copy" | "cards" | "targets" | "bluff" | "unwind" | "plan" | "retain-cash";

export interface Decision {
    readonly action: NpcAction;
    readonly nextMemory: NpcMemory;
    readonly reason: ReasonCode;
}

export { legalActions, transition, tradeError, money } from "./market";

export { settledPrice } from "../../../shared/settlement";
