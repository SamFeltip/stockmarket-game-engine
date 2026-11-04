import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

function files(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}

test("the shared engine and headless runtime never import the live app, Convex, or React", () => {
    const roots = [new URL("../../stockmarket-shared/src/", import.meta.url), new URL("../src/", import.meta.url)];
    for (const file of roots.flatMap((root) => files(fileURLToPath(root)))) {
        if (!file.endsWith(".ts")) { continue; }
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)) {
            assert.ok(match[1].startsWith("."), `${file}: external dependency ${match[1]}`);
            assert.ok(!/stockmarket-convex|react|_generated/.test(match[1]), `${file}: live backend dependency`);
        }
    }
});
