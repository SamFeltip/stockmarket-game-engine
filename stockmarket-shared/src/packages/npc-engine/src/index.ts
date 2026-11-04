import type { Decision, NpcMemory, NpcObservation, NpcProfile } from "../../game-contracts/src";
import { estimate } from "./estimate";
import { updateMemory } from "./memory";
import { random } from "./random";
import { towardTargets } from "./targets";
import { frankie } from "./personalities/frankie";
import { ada, adaEasy } from "./personalities/ada";
import { casey, caseyEasy } from "./personalities/casey";
import { felix } from "./personalities/felix";
import { morgan, morganEstimates } from "./personalities/morgan";
import { chooseChance } from "./chance";
import { plan } from "./planning";
export { roster } from "./roster";

export { emptyMemory } from "./memory";

export { isLegalProposal } from "./candidates";

export { engineVersion } from "./difficulty";

export function decide(
    observation: NpcObservation,
    profile: NpcProfile,
    saved: NpcMemory,
    seed: string,
): Decision
{
    const memory = updateMemory(observation, saved);
    const next = random(`${seed}:decisions`);
    const estimates = estimate(observation, profile.difficulty === "hard", seed);
    const finish = (action: Decision["action"], reason: Decision["reason"]): Decision => ({
        action,
        nextMemory: memory,
        reason: action.kind === "pass" ? "retain-cash" : reason,
    });

    const chance = chooseChance(observation);
    if (chance)
    {
        return finish(chance, "cards");
    }

    switch (profile.personality)
    {
        case "frankie": {
            const preference = frankie(observation, profile, estimates);

            return finish(towardTargets(observation, estimates, preference), preference.reason);
        }
        case "ada": {
            return finish(
                profile.difficulty === "easy"
                    ? adaEasy(observation)
                    : towardTargets(observation, estimates, ada(observation, profile, estimates)),
                "cards",
            );
        }
        case "casey": {
            return finish(
                profile.difficulty === "easy"
                    ? caseyEasy(observation, next)
                    : towardTargets(
                        observation,
                        estimates,
                        casey(observation, profile, estimates, memory),
                    ),
                "copy",
            );
        }
        case "felix": {
            return felix(observation, profile, estimates, memory, next);
        }
        case "morgan": {
            const combined = morganEstimates(observation, profile, estimates, memory);

            return finish(
                profile.difficulty === "hard"
                    ? plan(observation, combined)
                    : towardTargets(observation, combined, morgan(observation, profile, combined)),
                profile.difficulty === "hard" ? "plan" : "targets",
            );
        }
    }
}
