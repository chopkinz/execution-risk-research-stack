export type MarketRange = "1m" | "3m" | "6m" | "1y";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketPayload = {
  tickerLabel: string;
  requestedSymbol: string;
  resolvedSymbol: string;
  range: MarketRange;
  candles: Candle[];
  source: "yahoo" | "stooq" | "fallback_proxy";
  note?: string;
  refreshedAtUtc: string;
};

const RANGE_DAYS: Record<MarketRange, number> = {
  "1m": 22,
  "3m": 66,
  "6m": 132,
  "1y": 252
};

type SymbolConfig = {
  label: string;
  yahoo: string;
  stooq?: string;
  fallbackSymbol?: string;
};

const SYMBOLS: Record<string, SymbolConfig> = {
  QQQ: { label: "Nasdaq 100 Proxy", yahoo: "QQQ", stooq: "qqq.us" },
  SPY: { label: "S&P 500 Proxy", yahoo: "SPY", stooq: "spy.us" },
  GLD: { label: "Gold Proxy", yahoo: "GLD", stooq: "gld.us" },
  UUP: { label: "USD Proxy", yahoo: "UUP", stooq: "uup.us" },
  "NQ=F": { label: "Nasdaq Futures", yahoo: "NQ=F", fallbackSymbol: "QQQ" },
  "ES=F": { label: "S&P Futures", yahoo: "ES=F", fallbackSymbol: "SPY" },
  "GC=F": { label: "Gold Futures", yahoo: "GC=F", fallbackSymbol: "GLD" },
  "EURUSD=X": { label: "EURUSD Spot", yahoo: "EURUSD=X", fallbackSymbol: "UUP" },
  "^NDX": { label: "Nasdaq 100 Index", yahoo: "^NDX", fallbackSymbol: "QQQ" },
  "^GSPC": { label: "S&P 500 Index", yahoo: "^GSPC", fallbackSymbol: "SPY" }
};

type CacheEntry = {
  expiresAt: number;
  data: MarketPayload;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_TTL_1H_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6000;
const RETRIES = 2;
const cache = new Map<string, CacheEntry>();
const cache1h = new Map<string, { expiresAt: number; data: Candle[] }>();

function normalizeSymbol(input?: string | null): string {
  if (!input) return "QQQ";
  const trimmed = input.trim();
  const direct = Object.keys(SYMBOLS).find((key) => key.toUpperCase() === trimmed.toUpperCase());
  return direct ?? "QQQ";
}

function parseCsv(text: string): Array<Omit<Candle, "time"> & { date: string }> {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const out: Array<Omit<Candle, "time"> & { date: string }> = [];
  for (const line of lines.slice(1)) {
    const [date, open, high, low, close, volume] = line.split(",");
    if (!date || !open || !high || !low || !close) continue;
    const parsed = {
      date,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume || 0)
    };
    if ([parsed.open, parsed.high, parsed.low, parsed.close].some((n) => Number.isNaN(n))) continue;
    out.push(parsed);
  }
  return out;
}

function parseYahooChart(json: unknown): Candle[] {
  const parsed = json as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            close?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }>;
    };
  };

  const result = parsed?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const open = quote?.open ?? [];
  const high = quote?.high ?? [];
  const low = quote?.low ?? [];
  const close = quote?.close ?? [];
  const volume = quote?.volume ?? [];

  const out: Candle[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = timestamps[i];
    const o = open[i];
    const h = high[i];
    const l = low[i];
    const c = close[i];
    const v = volume[i] ?? 0;
    if (
      typeof ts !== "number" ||
      typeof o !== "number" ||
      typeof h !== "number" ||
      typeof l !== "number" ||
      typeof c !== "number" ||
      Number.isNaN(o) ||
      Number.isNaN(h) ||
      Number.isNaN(l) ||
      Number.isNaN(c)
    ) {
      continue;
    }
    out.push({
      time: ts,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: typeof v === "number" && Number.isFinite(v) ? v : 0
    });
  }
  return out;
}

function sliceRange(candles: Candle[], range: MarketRange): Candle[] {
  const count = RANGE_DAYS[range];
  if (candles.length <= count) return candles;
  return candles.slice(candles.length - count);
}

function toEpochFromDate(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
}

async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= RETRIES; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
      next: { revalidate: 600 }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYahooCandles(yahooSymbol: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2y`;
  const response = await withRetries(() => fetchWithTimeout(url));
  if (!response.ok) {
    throw new Error(`Yahoo request failed (${response.status})`);
  }
  const json = (await response.json()) as unknown;
  const candles = parseYahooChart(json);
  if (!candles.length) {
    throw new Error("Yahoo returned no candle rows");
  }
  return candles;
}

/** 1h candles for last 5 days (session analysis). Cached 5 min. Timestamps are UTC epoch. */
export async function fetchYahooCandles1h(yahooSymbol: string): Promise<Candle[]> {
  const now = Date.now();
  const hit = cache1h.get(yahooSymbol);
  if (hit && hit.expiresAt > now) return hit.data;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1h&range=5d`;
  const response = await withRetries(() => fetchWithTimeout(url));
  if (!response.ok) {
    throw new Error(`Yahoo 1h request failed (${response.status})`);
  }
  const json = (await response.json()) as unknown;
  const candles = parseYahooChart(json);
  if (!candles.length) {
    throw new Error("Yahoo returned no 1h candle rows");
  }
  cache1h.set(yahooSymbol, { expiresAt: now + CACHE_TTL_1H_MS, data: candles });
  return candles;
}

async function fetchStooqCandles(stooqSymbol: string): Promise<Candle[]> {
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol}&i=d`;
  const response = await withRetries(() => fetchWithTimeout(url));
  if (!response.ok) {
    throw new Error(`Stooq request failed (${response.status})`);
  }
  const text = await response.text();
  const parsed = parseCsv(text);
  const candles = parsed.map((row) => ({
    time: toEpochFromDate(row.date),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume
  }));
  if (!candles.length) {
    throw new Error("Stooq returned no candle rows");
  }
  return candles;
}

function buildPayload(
  requestedSymbol: string,
  resolvedSymbol: string,
  range: MarketRange,
  source: MarketPayload["source"],
  candles: Candle[],
  note?: string
): MarketPayload {
  return {
    tickerLabel: SYMBOLS[resolvedSymbol]?.label ?? resolvedSymbol,
    requestedSymbol,
    resolvedSymbol,
    range,
    candles: sliceRange(candles, range),
    source,
    note,
    refreshedAtUtc: new Date().toISOString()
  };
}

export async function fetchMarketData(inputSymbol: string | null, range: MarketRange): Promise<MarketPayload> {
  const requestedSymbol = normalizeSymbol(inputSymbol);
  const cacheKey = `${requestedSymbol}:${range}`;
  const hit = cache.get(cacheKey);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    return hit.data;
  }

  const config = SYMBOLS[requestedSymbol];

  try {
    const candles = await fetchYahooCandles(config.yahoo);
    const payload = buildPayload(requestedSymbol, requestedSymbol, range, "yahoo", candles);
    cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, data: payload });
    return payload;
  } catch {
    // Continue to fallback flow.
  }

  if (config.fallbackSymbol) {
    const fallbackCfg = SYMBOLS[config.fallbackSymbol];
    try {
      const candles = await fetchYahooCandles(fallbackCfg.yahoo);
      const payload = buildPayload(
        requestedSymbol,
        config.fallbackSymbol,
        range,
        "fallback_proxy",
        candles,
        `Proxy fallback used: ${config.fallbackSymbol}`
      );
      cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, data: payload });
      return payload;
    } catch {
      // Continue to Stooq flow.
    }
  }

  try {
    const targetForStooq = config.stooq ? requestedSymbol : config.fallbackSymbol;
    if (targetForStooq) {
      const stooqCfg = SYMBOLS[targetForStooq];
      if (stooqCfg.stooq) {
        const candles = await fetchStooqCandles(stooqCfg.stooq);
        const isProxy = targetForStooq !== requestedSymbol;
        const payload = buildPayload(
          requestedSymbol,
          targetForStooq,
          range,
          isProxy ? "fallback_proxy" : "stooq",
          candles,
          isProxy ? `Proxy fallback used: ${targetForStooq}` : undefined
        );
        cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, data: payload });
        return payload;
      }
    }
  } catch {
    // final failure below
  }

  throw new Error("Data temporarily unavailable");
}

export function isMarketRange(value: string): value is MarketRange {
  return value === "1m" || value === "3m" || value === "6m" || value === "1y";
}

export function getYahooSymbol(inputSymbol: string): string {
  const key = normalizeSymbol(inputSymbol);
  const config = SYMBOLS[key];
  return config?.yahoo ?? inputSymbol;
}
