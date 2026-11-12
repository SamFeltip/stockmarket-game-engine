import { insightCatalog, stockCatalog } from "../catalog";
import { cashStockKey, chanceStockKey, specialDeck, type DeckCard } from "../shared/chance-cards";
import { legacyTechRounds, techMarketSteps, type Pack } from "../shared/packs";
import { fail } from "./library";
import type { Document_, MutationContext } from "./model";
import { techForecasts } from "./techMarket";

const retailHandSize = 10;
const franticChanceHandSize = 2;

const franticDownsidePrefix = "frantic:downside:";
// Each row lists the Frantic gains for Classic denominations £0.50, £1, £1.50, and so on.
const franticGains: Partial<Record<number, readonly number[]>> = {
    8: [2.10, 4.20, 6.30],
    9: [3.04, 6.10, 9.14],
    10: [4.42, 8.84, 13.26, 17.68],
    11: [6.40, 12.82, 19.22, 25.64, 32.04],
    12: [9.30, 18.58, 27.88, 37.18, 46.48, 55.76],
};
// Keep the existing negative deck while increasing gains.
const franticDownside: Partial<Record<number, number>> = { 7: 191, 8: 12, 9: 18, 10: 43, 11: 94, 12: 191 };

function franticStockDeck(catalog: DeckCard[], stock: typeof stockCatalog[number])
{
    const classic = catalog.filter((card) => card.stockKey === stock.key);
    const natwest = catalog.filter((card) => card.stockKey === 12);
    const source = stock.key === 7 && natwest.length > 0 ? natwest : classic;
    const negatives = classic.filter((card) => card.value < 0);
    const gains = franticGains[stock.key === 7 ? 12 : stock.key];
    const cardWithValue = (id: string, value: number): DeckCard =>
        ({ id, stockKey: stock.key, value, description: `${stock.name} Insight ${value.toFixed(2)}` });

    let negativeIndex = 0;
    const base = source.flatMap((card) =>
    {
        const id = card.stockKey === stock.key ? card.id : `frantic:trusthouse:${card.id}`;
        if (card.value >= 0)
        {
            return [cardWithValue(id, gains?.[card.value / 0.5 - 1] ?? card.value)];
        }

        const negative = negatives[negativeIndex++ % negatives.length];

        return negative ? [cardWithValue(id, negative.value * 2)] : [];
    });
    const baseDownside = base.reduce((sum, card) => sum - Math.min(0, card.value), 0);
    let remaining = (franticDownside[stock.key] ?? 0) - baseDownside;
    const sizes = [...new Set(negatives.map((card) => -2 * card.value))].sort((a, b) => a - b);
    const extra: DeckCard[] = [];

    while (sizes.length > 0 && remaining >= sizes[0])
    {
        for (const size of sizes)
        {
            if (size <= remaining)
            {
                extra.push(cardWithValue(`${franticDownsidePrefix}${stock.key}:${extra.length}`, -size));
                remaining -= size;
            }
        }
    }

    return [...base, ...extra];
}

function retailStockCards(): DeckCard[]
{
    return insightCatalog.map(({ key, stockKey, value, description }) =>
        ({ id: `boardgame:insight:${key}`, stockKey, value, description }));
}

function franticStockCards()
{
    const catalog = retailStockCards();

    return stockCatalog.flatMap((stock) => franticStockDeck(catalog, stock));
}

export function shuffleDeck<T>(context: MutationContext, deck: T[])
{
    // Convex supplies seeded randomness that is stable across transaction retries.
    for (let index = deck.length - 1; index > 0; index--)
    {
        const pick = Math.floor(context.random() * (index + 1));

        [deck[index], deck[pick]] = [deck[pick], deck[index]];
    }

    return deck;
}

function drawHands(cards: DeckCard[], seats: number, size: number)
{
    if (cards.length < seats * size)
    {
        fail("Not enough insights for all players");
    }

    return Array.from({ length: seats }, (_, index) => cards.slice(index * size, (index + 1) * size));
}

function dealFranticHands(context: MutationContext, deck: DeckCard[], seats: number)
{
    // The extra negatives are dealt separately, preserving the original draw rate for base cards.
    const extra = deck.filter((card) => card.id.startsWith(franticDownsidePrefix));
    const reserved = deck.filter((card) => card.stockKey === chanceStockKey).slice(0, seats * franticChanceHandSize);
    const reservedIds = new Set(reserved.map((card) => card.id));
    const base = deck.filter((card) => !reservedIds.has(card.id) && !card.id.startsWith(franticDownsidePrefix));
    const ordinary = drawHands(base, seats, retailHandSize);
    const chance = drawHands(reserved, seats, franticChanceHandSize);
    // Stochastic rounding gives each extra card the same expected draw rate as a base stock card.
    const extraPerSeat = extra.length === 0 ? 0 : Math.floor(retailHandSize * extra.length / base.length + context.random());
    const extras = drawHands(extra, seats, Math.min(extraPerSeat, Math.floor(extra.length / seats)));

    return ordinary.map((hand, index) => hand.concat(chance[index], extras[index]));
}

export function forecastDealPeriod(game: Document_<"games">)
{
    return legacyTechRounds(game) ? game.currentPeriod - game.currentPeriod % techMarketSteps : game.currentPeriod;
}

function dealTechHands(context: MutationContext, game: Document_<"games">, deck: DeckCard[], seats: number)
{
    const chance = deck.filter((card) => card.stockKey === chanceStockKey);
    const cash = deck.filter((card) => card.stockKey === cashStockKey);
    if (chance.length < seats || cash.length < seats)
    {
        fail("Not enough chance or cash insights for all players");
    }

    const windows = game.currentPeriod === forecastDealPeriod(game) ? shuffleDeck(context, techForecasts(game)) : [];
    // Reserve windows spanning the block, then add random windows without duplicating any.
    const coverage = windows.filter((window) => window.coversBlock);
    const selected = coverage.concat(windows.filter((window) => !window.coversBlock).slice(0, seats * 2 - coverage.length));
    const forecasts = shuffleDeck(context, selected);

    return Array.from({ length: seats }, (_, index) =>
        [chance[index], cash[index], ...forecasts.slice(index * 2, (index + 1) * 2).flatMap((window) => window.cards)]);
}

interface PackDeck {
    stockCards(): DeckCard[];
    deal(context: MutationContext, game: Document_<"games">, shuffled: DeckCard[], seats: number): DeckCard[][];
    catalogVersion?: string;
    opponentDrawSize?(handSize: number): number;
}

const retailDeck: PackDeck = {
    stockCards: retailStockCards,
    deal: (_context, _game, deck, seats) => drawHands(deck, seats, retailHandSize),
};

const decks: Record<Pack, PackDeck> = {
    classic: { ...retailDeck, catalogVersion: "boardgame-108-v2" },
    frantic: {
        stockCards: franticStockCards,
        deal: (context, _game, deck, seats) => dealFranticHands(context, deck, seats),
        catalogVersion: "frantic-downside-v3",
        opponentDrawSize: (handSize) => handSize,
    },
    tech: {
        stockCards: () => [],
        deal: dealTechHands,
        opponentDrawSize: () => 0,
    },
};

export function deckForPack(pack: Pack = "classic")
{
    return decks[pack];
}

/** Every new game gets its stock, cash, and chance cards from the code catalog. */
export function buildDeck(pack: Pack = "classic")
{
    return [...deckForPack(pack).stockCards(), ...specialDeck(pack)];
}
