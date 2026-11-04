import type { Document_, GameStore, Id, IndexRange, Selection, Table, Tables } from "../../stockmarket-shared/src/engine/model";

// These are storage ordering definitions, not gameplay rules.
const indexes: Record<string, string[]> = {
    by_key: ["key"], by_game: ["gameId"], by_game_period: ["gameId", "period"],
    by_game_period_turn: ["gameId", "period", "turn"], by_player_period: ["playerId", "period"],
};
type Row = Document_<Table>;
export interface StoreSnapshot { rows: Row[]; sequence: number; tables: [string, Table][] }

export class MemoryStore implements GameStore {
    private rows = new Map<string, Row>();
    private sequence = 0;
    private tables = new Map<string, Table>();
    private journal: Map<string, Row | undefined> | undefined;
    private initialSequence = 0;

    snapshot(): StoreSnapshot {
        return structuredClone({ rows: [...this.rows.values()], sequence: this.sequence, tables: [...this.tables] });
    }
    restore(snapshot: StoreSnapshot): void {
        this.rows = new Map(structuredClone(snapshot.rows).map((row) => [row._id, row]));
        this.sequence = snapshot.sequence;
        this.tables = new Map(snapshot.tables);
    }
    begin(): void {
        if (this.journal) { throw new Error("Concurrent or nested environment step"); }
        this.journal = new Map();
        this.initialSequence = this.sequence;
    }
    commit(): void { this.journal = undefined; }
    rollback(): void {
        for (const [id, before] of this.journal ?? []) {
            if (before) { this.rows.set(id, before); }
            else { this.rows.delete(id); this.tables.delete(id); }
        }
        this.sequence = this.initialSequence;
        this.journal = undefined;
    }
    private record(id: string): void {
        if (this.journal && !this.journal.has(id)) { this.journal.set(id, this.rows.get(id)); }
    }
    async get<T extends Table>(id: Id<T>): Promise<Document_<T> | null> {
        return structuredClone(this.rows.get(id) ?? null) as Document_<T> | null;
    }
    async insert<T extends Table>(table: T, value: Tables[T]): Promise<Id<T>> {
        const id = `${table}:${String(++this.sequence).padStart(8, "0")}` as Id<T>;
        this.record(id);
        this.rows.set(id, structuredClone({ ...value, _id: id, _creationTime: this.sequence }) as unknown as Row);
        this.tables.set(id, table);
        return id;
    }
    async patch<T extends Table>(id: Id<T>, value: Partial<Tables[T]>): Promise<void> {
        const before = this.rows.get(id);
        if (!before) { throw new Error(`Missing document: ${id}`); }
        this.record(id);
        const updated = { ...before, ...structuredClone(value) };
        for (const key of Object.keys(value)) {
            if (Reflect.get(value, key) === undefined) { Reflect.deleteProperty(updated, key); }
        }
        this.rows.set(id, updated);
    }
    query<T extends Table>(table: T): Selection<T> {
        const filters: [string, unknown][] = [];
        let ordering: string[] = [];
        const collect = async (): Promise<Document_<T>[]> => {
            const rows = [...this.rows.values()].filter((row) => this.tables.get(row._id) === table
                && filters.every(([key, value]) => Reflect.get(row, key) === value));
            rows.sort((a, b) => {
                for (const key of [...ordering, "_creationTime"]) {
                    const left = Reflect.get(a, key) as string | number | undefined;
                    const right = Reflect.get(b, key) as string | number | undefined;
                    if (left === right) { continue; }
                    if (left === undefined) { return -1; }
                    if (right === undefined) { return 1; }
                    return left < right ? -1 : 1;
                }
                return 0;
            });
            return structuredClone(rows) as unknown as Document_<T>[];
        };
        const selection: Selection<T> = {
            withIndex: (name, range) => {
                if (!indexes[name]) { throw new Error(`Unsupported index: ${name}`); }
                ordering = indexes[name];
                const builder: IndexRange<T> = {
                    eq: (field, value) => { filters.push([String(field), value]); return builder; },
                };
                range(builder);
                return selection;
            },
            collect,
            first: async () => (await collect())[0] ?? null,
            unique: async () => {
                const rows = await collect();
                if (rows.length > 1) { throw new Error("Expected a unique document"); }
                return rows[0] ?? null;
            },
        };
        return selection;
    }
}
