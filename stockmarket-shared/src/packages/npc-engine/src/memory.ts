import type { NpcMemory, NpcObservation } from "../../game-contracts/src";
export function emptyMemory(): NpcMemory
{
    return { version: 1, settledThrough: -1, credibility: [], followers: [], observedThrough: "" };
}

export function updateMemory(observation: NpcObservation, memory: NpcMemory): NpcMemory
{
    const credibility = memory.credibility.map((item) => ({ ...item, scores: [...item.scores] }));
    let settledThrough = memory.settledThrough;
    for (const summary of observation.settledPeriods.filter(
        (item) => item.period > memory.settledThrough,
    ))
    {
        for (const seat of observation.players.filter((item) => item.id !== observation.selfId))
        {
            for (const price of summary.opening)
            {
                const net = netTrades(observation, seat.id, price.stockKey, summary.period);
                const change
                    = (summary.settled.find((item) => item.stockKey === price.stockKey)?.value
                      ?? price.value) - price.value;
                let entry = credibility.find(
                    (item) => item.playerId === seat.id && item.stockKey === price.stockKey,
                );
                if (!entry)
                {
                    entry = { playerId: seat.id, stockKey: price.stockKey, scores: [] };
                    credibility.push(entry);
                }

                entry.scores = [...entry.scores, Math.sign(net) * Math.sign(change)].slice(-3);
            }
        }

        settledThrough = summary.period;
    }

    const followers = memory.followers.map((item) => ({ ...item }));
    // Observe responses to genuine purchases as well as bait, so Hard Felix can learn before its first bluff.
    for (const [index, event] of observation.events.entries())
    {
        const key = `${event.period}:${String(event.turn).padStart(4, "0")}`;
        if (
            event.period !== observation.period
            || key <= memory.observedThrough
            || event.actorPlayerId === observation.selfId
            || event.action.kind !== "buy"
        )
        {
            continue;
        }

        const previous = observation.events
            .slice(0, index)
            .findLast(
                (item) => item.period === event.period && item.actorPlayerId === observation.selfId,
            );
        if (previous?.action.kind !== "buy" || previous.action.stockKey !== event.action.stockKey)
        {
            continue;
        }

        const entry = followers.find((item) => item.playerId === event.actorPlayerId);
        if (entry)
        {
            entry.responses++;
        }
        else
        {
            followers.push({ playerId: event.actorPlayerId, responses: 1 });
        }
    }

    if (
        memory.bait
        && memory.bait.period === observation.period
        && observation.turn > memory.bait.turn
    )
    {
        const bait = memory.bait;
        for (const follower of followers)
        {
            const responded = observation.events.some(
                (event) =>
                    event.period === bait.period
                    && event.turn > bait.turn
                    && event.actorPlayerId === follower.playerId
                    && event.action.kind === "buy"
                    && event.action.stockKey === bait.stockKey,
            );
            if (!responded)
            {
                follower.responses = Math.max(0, follower.responses - 1);
            }
        }
    }

    const latest = observation.events.at(-1);
    const leaderId
        = memory.leaderPeriod === observation.period
            ? memory.leaderId
            : observation.players
                .filter((seat) => seat.id !== observation.selfId)
                .toSorted(
                    (a, b) =>
                        a.periodStartRanking - b.periodStartRanking || a.id.localeCompare(b.id),
                )[0]?.id;

    return {
        ...memory,
        credibility,
        settledThrough,
        followers,
        leaderId,
        leaderPeriod: observation.period,
        observedThrough: latest
            ? `${latest.period}:${String(latest.turn).padStart(4, "0")}`
            : memory.observedThrough,
    };
}

export function netTrades(
    observation: NpcObservation,
    playerId: string,
    stockKey: number,
    period = observation.period,
): number
{
    return observation.events.reduce(
        (sum, event) =>
            sum
            + (event.period === period
              && event.actorPlayerId === playerId
              && event.action.kind !== "pass"
              && event.action.stockKey === stockKey
                ? event.action.quantity * (event.action.kind === "buy" ? 1 : -1)
                : 0),
        0,
    );
}

export function behaviour(
    observation: NpcObservation,
    memory: NpcMemory,
    stockKey: number,
    credibleOnly = false,
): number
{
    // Public RMS card value scaled to the standard deviation of unseen dealt cards, in pounds/share.
    const values = observation.catalog.map((card) => (card.stockKey === stockKey ? card.value : 0));
    const scale = Math.sqrt(
        (values.reduce((sum, value) => sum + value * value, 0) / Math.max(1, values.length))
        * 10
        * (observation.players.length - 1),
    );
    let weighted = 0;
    let weights = 0;
    for (const seat of observation.players.filter((item) => item.id !== observation.selfId))
    {
        const scores
            = memory.credibility.find(
                (item) => item.playerId === seat.id && item.stockKey === stockKey,
            )?.scores ?? [];
        const score = scores.reduce((sum, value) => sum + value, 0) / (scores.length + 2);
        if (credibleOnly && score <= 0)
        {
            continue;
        }

        const weight = Math.max(0, 0.25 + score);

        weighted += Math.sign(netTrades(observation, seat.id, stockKey)) * weight;
        weights += weight;
    }

    return weights ? (scale * weighted) / weights : 0;
}
