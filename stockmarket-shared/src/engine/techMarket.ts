import data from "../data/tech-daily-closes.json" with { type: "json" };
import { techMonthsPerPeriod, techRoundsPerBlock } from "../shared/packs";
import type { DeckCard } from "../shared/chance-cards";

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

function closeIndex(start: number, period: number)
{
    if (period === 0)
    {
        return monthStarts[start];
    }

    const block = Math.floor((period - 1) / techRoundsPerBlock);
    const step = (period - 1) % techRoundsPerBlock + 1;
    const opening = block === 0 ? monthStarts[start] : monthStarts[start + block * techMonthsPerPeriod] - 1;
    const closing = monthStarts[start + (block + 1) * techMonthsPerPeriod] - 1;

    return opening + Math.floor((closing - opening) * step / techRoundsPerBlock);
}

export function techPrices(start: number, period: number)
{
    const quote = quotes[closeIndex(start, period)];

    return techStocks.map((stock, index) => ({ stockKey: stock.key, value: Number(quote[index + 1]) }));
}

const formatDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function techForecasts(start: number, period: number): DeckCard[][]
{
    // Nine three-step windows and three four-step windows, distinct for each company.
    const windows = Array.from({ length: 12 }, (_, index) =>
        index < 9 ? [index, index + 3] : [index - 9, index - 5]);

    return windows.map(([from, to]) =>
    {
        const opening = quotes[closeIndex(start, period + from)];
        const closing = quotes[closeIndex(start, period + to)];
        const dates = `${formatDate.format(new Date(opening[0]))} – ${formatDate.format(new Date(closing[0]))}`;

        return techStocks.map((stock, index) => ({
            id: `tech:${period}:${stock.key}:${from}:${to}`, stockKey: stock.key,
            value: Math.round((Number(closing[index + 1]) - Number(opening[index + 1])) * 100) / 100,
            description: dates, forecast: { from: period + from, to: period + to },
        }));
    });
}

export function techTradingDates(start: number, period: number)
{
    return {
        from: quotes[closeIndex(start, period)][0],
        to: quotes[closeIndex(start, period + 1)][0],
    };
}
