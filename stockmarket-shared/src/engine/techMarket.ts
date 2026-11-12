import data from "../data/tech-daily-closes.json" with { type: "json" };
import { legacyTechRounds, techMarketStep, techMarketSteps, techMonthsPerPeriod } from "../shared/packs";
import type { DeckCard } from "../shared/chance-cards";
import type { Document_ } from "./model";

type TechGame = Pick<Document_<"games">, "pack" | "periodCount" | "currentPeriod" | "techStart">;

const quotes = data.quotes as [string, ...number[]][];
const monthStarts = quotes.flatMap(([date], index) =>
    date.slice(0, 7) !== quotes[index - 1]?.[0].slice(0, 7) ? [index] : []);

const volatilityOrder = data.tickers.map((_, index) =>
{
    const column = index + 1;
    const returns = quotes.slice(1).map((quote, day) => Math.log(Number(quote[column]) / Number(quotes[day][column])));
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;

    return { index, variance };
}).sort((a, b) => a.variance - b.variance).map(({ index }) => index);

export const techStocks = [
    { key: 106, name: "ASML", logo: "asml" },
    { key: 101, name: "Facebook", logo: "facebook" },
    { key: 102, name: "Nvidia", logo: "nvidia" },
    { key: 103, name: "Alibaba", logo: "alibaba" },
    { key: 104, name: "Apple", logo: "apple" },
    { key: 105, name: "Netflix", logo: "netflix" },
].map(({ key, name, logo }, index) => ({
    key, name, display: true, variation: volatilityOrder.indexOf(index) + 1, startingValue: 0,
    imagePath: `/static/imgs/stocks/${logo}.png`,
    secondaryImagePath: `/static/imgs/stocks/${logo}_secondary.png`,
}));

export function chooseTechStart(random: number, periods: number)
{
    // The final month in the source is partial, so it may only mark the end of a window.
    return Math.floor(random * (monthStarts.length - periods * techMonthsPerPeriod));
}

function closeIndex(start: number, marketStep: number)
{
    if (marketStep === 0)
    {
        return monthStarts[start];
    }

    const block = Math.floor((marketStep - 1) / techMarketSteps);
    const step = (marketStep - 1) % techMarketSteps + 1;
    const opening = block === 0 ? monthStarts[start] : monthStarts[start + block * techMonthsPerPeriod] - 1;
    const closing = monthStarts[start + (block + 1) * techMonthsPerPeriod] - 1;

    return opening + Math.floor((closing - opening) * step / techMarketSteps);
}

function quotePrices(quote: (typeof quotes)[number])
{
    return techStocks.map((stock, index) => ({ stockKey: stock.key, value: Number(quote[index + 1]) }));
}

export function techPrices(start: number, period: number)
{
    return quotePrices(quotes[closeIndex(start, period * techMarketSteps)]);
}

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function forecastCaption(from: string, to: string)
{
    const openingFormat = from.slice(0, 4) === to.slice(0, 4) ? shortDate : fullDate;

    return `${openingFormat.format(new Date(from))} – ${fullDate.format(new Date(to))}`;
}

export function techForecastDescription(start: number | undefined, card: Pick<DeckCard, "forecast" | "description">)
{
    if (start === undefined || !card.forecast)
    {
        return card.description;
    }

    return forecastCaption(quotes[closeIndex(start, card.forecast.from)][0],
        quotes[closeIndex(start, card.forecast.to)][0]);
}

function periodBounds(game: TechGame)
{
    const step = techMarketStep(game);
    const length = legacyTechRounds(game) ? 1 : techMarketSteps;

    return {
        opening: closeIndex(game.techStart!, step),
        closing: closeIndex(game.techStart!, step + length),
    };
}

export function techPeriodCloses(game: TechGame)
{
    const { opening, closing } = periodBounds(game);

    return quotes.slice(opening + 1, closing + 1).map((quote) => ({
        date: quote[0],
        label: fullDate.format(new Date(quote[0])),
        prices: quotePrices(quote),
    }));
}

export function techForecasts(game: TechGame): { coversBlock: boolean; cards: DeckCard[] }[]
{
    const legacy = legacyTechRounds(game);
    const windows = [
        ...Array.from({ length: legacy ? 9 : 10 }, (_, from) => [from, from + 3]),
        ...(legacy ? [[0, 4], [1, 5], [2, 6]] : [[2, 6], [6, 10]]),
    ];
    const blockStart = techMarketStep(game);

    return windows.map(([from, to]) =>
    {
        const opening = quotes[closeIndex(game.techStart!, blockStart + from)];
        const closing = quotes[closeIndex(game.techStart!, blockStart + to)];
        const dates = forecastCaption(opening[0], closing[0]);

        return {
            coversBlock: !legacy && from % 3 === 0 && to - from === 3,
            cards: techStocks.map((stock, index) => ({
                id: `tech:${game.currentPeriod}:${stock.key}:${from}:${to}`, stockKey: stock.key,
                value: Math.round((Number(closing[index + 1]) - Number(opening[index + 1])) * 100) / 100,
                description: dates, forecast: { from: blockStart + from, to: blockStart + to },
            })),
        };
    });
}

export function techTradingDates(game: TechGame)
{
    const steps = legacyTechRounds(game) ? 1 : techMarketSteps;
    const closeIndices = Array.from({ length: game.periodCount + 2 }, (_, period) =>
        closeIndex(game.techStart!, period * steps));
    const boundaries = closeIndices.map((index) => quotes[index][0]);
    const dailyCloses = closeIndices.slice(0, game.currentPeriod + 1).map((opening, period) =>
        quotes.slice(opening + 1, closeIndices[period + 1] + 1).map(([date]) => date));

    return { from: boundaries[game.currentPeriod], to: boundaries[game.currentPeriod + 1], boundaries, dailyCloses };
}
