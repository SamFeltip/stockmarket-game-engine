export function random(seed: string): () => number
{
    let state = 2_166_136_261;
    for (const char of seed)
    {
        state = Math.imul(state ^ char.codePointAt(0)!, 16_777_619);
    }

    return () =>
    {
        state += 0x6D_2B_79_F5;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);

        value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);

        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
}

export function shuffled<T>(items: readonly T[], next: () => number): T[]
{
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--)
    {
        const other = Math.floor(next() * (index + 1));

        [result[index], result[other]] = [result[other], result[index]];
    }

    return result;
}
