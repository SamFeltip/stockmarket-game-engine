import { registerHooks } from "node:module";

// Resolve shared TypeScript source without a bundler or a dependency on the web app.
registerHooks({
    resolve(specifier, context, nextResolve)
    {
        try
        {
            return nextResolve(specifier, context);
        }
        catch (error)
        {
            if (!["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"].includes(error.code) || !specifier.startsWith("."))
            {
                throw error;
            }

            for (const suffix of [".ts", "/index.ts"])
            {
                try
                {
                    return nextResolve(specifier + suffix, context);
                }
                catch (candidateError)
                {
                    if (!["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"].includes(candidateError.code))
                    {
                        throw candidateError;
                    }
                }
            }

            throw error;
        }
    },
});
