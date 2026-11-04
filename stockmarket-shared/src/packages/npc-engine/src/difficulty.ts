export const engineVersion = 1;

export const tuningVersion = 1;

export const sampleCount = 128;

export const planLimit = 64;

export const difficulty = {
    easy: { risk: 0, samples: 0 },
    medium: { risk: 0.04, samples: 0 },
    hard: { risk: 0.12, samples: sampleCount },
} as const;
