import type { Action, NpcProfile } from "../packages/game-contracts/src";
import type { ChanceKind, DeckCard } from "../shared/chance-cards";
import type { CompanyRole } from "../shared/company-roles";

// Platform-neutral IDs are structurally compatible with the live persistence adapter.
export type Id<T extends string> = string & { __tableName: T };
type Prices = { stockKey: number; value: number }[];
type Qualification = { stockKey: number; order: number }[];
export interface Tables {
    games: {
        code: string; hostId?: Id<"users">; spectatorHostId?: Id<"users">; tvTokenHash?: string;
        currentUserId?: Id<"users">; currentPlayerId?: Id<"players">; npcDifficulty?: NpcProfile["difficulty"];
        rulesVersion?: number; rosterRevision?: number; catalogVersion?: string;
        periodCount: number; currentPeriod: number; turn: number;
        status: "waiting" | "playing" | "closed" | "special_insights" | "finished";
        prices: Prices; priceHistory?: { period: number; prices: Prices }[];
        suspended: number[]; suspensionPeriod?: number;
        rightsIssue?: {
            insightId: Id<"playerInsights">; stockKey: number; actorPlayerId: Id<"players">;
            period: number; turn: number; index: number; completed?: boolean;
            offers: { playerId: Id<"players">; held: number; maximum: number; purchased?: number }[];
        };
    };
    players: {
        gameId: Id<"games">; userId?: Id<"users">;
        controller?: { kind: "human"; userId: Id<"users"> } | { kind: "npc"; personality: NpcProfile["personality"] };
        npcDifficulty?: NpcProfile["difficulty"]; seatOrder?: number; periodStartRanking?: number;
        cash: number; active: boolean; chairmanSince?: Qualification; directorSince?: Qualification;
        holdings: { stockKey: number; quantity: number }[];
    };
    users: { name: string; profileRoot: string; email?: string; emailVerificationTime?: number; isAnonymous?: boolean };
    stocks: { key: number; name: string; startingValue: number; imagePath: string;
        secondaryImagePath: string; variation: number; display: boolean };
    insights: { key: number; stockKey: number; description: string; value: number };
    playerInsights: { gameId: Id<"games">; playerId: Id<"players">; period: number; stockKey: number;
        description: string; value: number; resolved: boolean; used?: boolean; catalogCardId?: string; chanceKind?: ChanceKind };
    gameCatalogs: { gameId: Id<"games">; version: string; cards: DeckCard[] };
    gameActions: { gameId: Id<"games">; period: number; turn: number; actorPlayerId: Id<"players">;
        action: Action | { kind: "government-loan"; insightId: Id<"playerInsights"> }
        | { kind: "debenture"; insightId: Id<"playerInsights">; stockKey: number };
        unitPrice?: number; rightsIssueId?: Id<"playerInsights"> };
    periodSummaries: { gameId: Id<"games">; period: number; opening: Prices; settled: Prices };
    feed: { gameId: Id<"games">; period: number; title: string; message: string; imageRoot: string; colour: string;
        debenturePayout?: number; cashBonus?: number; stockKey?: number; quantity?: number;
        roleBefore?: CompanyRole; roleAfter?: CompanyRole };
}
export type Table = keyof Tables;
export type Document_<T extends Table> = Tables[T] & { _id: Id<T>; _creationTime: number };
export interface IndexRange<T extends Table> {
    eq<K extends keyof Tables[T]>(field: K, value: Tables[T][K]): IndexRange<T>;
}
export interface Selection<T extends Table> {
    withIndex(name: string, range: (query: IndexRange<T>) => IndexRange<T>): Selection<T>;
    collect(): Promise<Document_<T>[]>;
    unique(): Promise<Document_<T> | null>;
    first(): Promise<Document_<T> | null>;
}
export interface GameStore {
    get<T extends Table>(id: Id<T>): Promise<Document_<T> | null>;
    query<T extends Table>(table: T): Selection<T>;
    insert<T extends Table>(table: T, value: Tables[T]): Promise<Id<T>>;
    patch<T extends Table>(id: Id<T>, value: Partial<Tables[T]>): Promise<void>;
}
export interface QueryContext { db: GameStore }
export interface MutationContext extends QueryContext {
    random(): number;
    effects: {
        enqueueNextNpc(gameId: Id<"games">): Promise<void>;
        finishRightsLater(command: { gameId: Id<"games">; insightId: Id<"playerInsights"> }): Promise<void>;
    };
}
