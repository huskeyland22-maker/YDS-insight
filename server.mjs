import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function toIsoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function formatTickerValue(value, digits = 2) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatTickerDelta(latest, previous, options = {}) {
  if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous === 0) {
    return { text: "-", direction: "flat" };
  }
  const { digits = 2, isPercentPoint = false } = options;
  const diff = latest - previous;
  if (diff === 0) return { text: "0.00%", direction: "flat" };
  const pct = (diff / previous) * 100;
  const sign = pct > 0 ? "+" : "";
  const suffix = isPercentPoint ? "%p" : "%";
  return { text: `${sign}${pct.toFixed(digits)}${suffix}`, direction: pct > 0 ? "up" : "down" };
}

function average(values) {
  if (!Array.isArray(values) || !values.length) return Number.NaN;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return Number.NaN;
  return average(values.slice(values.length - period));
}

function rsi(values, period = 14) {
  if (!Array.isArray(values) || values.length <= period) return Number.NaN;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const prev = values[i - 1];
    const curr = values[i];
    const diff = curr - prev;
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function stochastic(highs, lows, closes, period = 14, smooth = 3) {
  if (!Array.isArray(closes) || closes.length < period + smooth) return { k: Number.NaN, d: Number.NaN };
  const kSeries = [];
  for (let i = period - 1; i < closes.length; i += 1) {
    const windowHigh = Math.max(...highs.slice(i - period + 1, i + 1));
    const windowLow = Math.min(...lows.slice(i - period + 1, i + 1));
    const close = closes[i];
    if (!Number.isFinite(windowHigh) || !Number.isFinite(windowLow) || windowHigh === windowLow) {
      kSeries.push(Number.NaN);
      continue;
    }
    const k = ((close - windowLow) / (windowHigh - windowLow)) * 100;
    kSeries.push(k);
  }
  const validK = kSeries.filter((v) => Number.isFinite(v));
  if (validK.length < smooth) return { k: Number.NaN, d: Number.NaN };
  const currentK = average(validK.slice(-smooth));
  const dValues = [];
  for (let i = smooth - 1; i < validK.length; i += 1) {
    dValues.push(average(validK.slice(i - smooth + 1, i + 1)));
  }
  const currentD = dValues.length ? dValues[dValues.length - 1] : Number.NaN;
  return { k: currentK, d: currentD };
}

function ema(values, period) {
  if (!Array.isArray(values) || values.length < period) return [];
  const alpha = 2 / (period + 1);
  const out = [];
  let prev = average(values.slice(0, period));
  out.push(prev);
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * alpha + prev * (1 - alpha);
    out.push(prev);
  }
  return out;
}

function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  if (!Array.isArray(values) || values.length < slow + signalPeriod) {
    return { macdLine: Number.NaN, signalLine: Number.NaN, histogram: Number.NaN };
  }
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  if (!fastEma.length || !slowEma.length) {
    return { macdLine: Number.NaN, signalLine: Number.NaN, histogram: Number.NaN };
  }
  const offset = slow - fast;
  const macdSeries = [];
  for (let i = 0; i < slowEma.length; i += 1) {
    const fastVal = fastEma[i + offset];
    const slowVal = slowEma[i];
    if (!Number.isFinite(fastVal) || !Number.isFinite(slowVal)) continue;
    macdSeries.push(fastVal - slowVal);
  }
  if (macdSeries.length < signalPeriod) {
    return { macdLine: Number.NaN, signalLine: Number.NaN, histogram: Number.NaN };
  }
  const signalSeries = ema(macdSeries, signalPeriod);
  if (!signalSeries.length) {
    return { macdLine: Number.NaN, signalLine: Number.NaN, histogram: Number.NaN };
  }
  const macdLine = macdSeries[macdSeries.length - 1];
  const signalLine = signalSeries[signalSeries.length - 1];
  return {
    macdLine,
    signalLine,
    histogram: macdLine - signalLine
  };
}

function classifyTiming(metrics) {
  const { close, ma20, ma60, rsi14, stochK, stochD, macdLine, macdSignal, volumeRatio20 } = metrics;
  const uptrend = Number.isFinite(close) && Number.isFinite(ma20) && Number.isFinite(ma60) && close > ma20 && ma20 > ma60;
  const pullback = Number.isFinite(close) && Number.isFinite(ma20) && close >= ma20 * 0.985 && close <= ma20 * 1.02;
  const overheated = (Number.isFinite(rsi14) && rsi14 >= 75) || (Number.isFinite(stochK) && Number.isFinite(stochD) && stochK > 80 && stochK < stochD);
  const golden = Number.isFinite(stochK) && Number.isFinite(stochD) && stochK > stochD && stochK < 60;
  const macdBull = Number.isFinite(macdLine) && Number.isFinite(macdSignal) && macdLine >= macdSignal;
  const macdBear = Number.isFinite(macdLine) && Number.isFinite(macdSignal) && macdLine < macdSignal;

  if (uptrend && (golden || pullback || macdBull) && !overheated) {
    return { grade: "A", state: "추세초입", action: "분할진입", tone: "good" };
  }
  if (overheated || macdBear) {
    return { grade: "C", state: "과열주의", action: "추격금지", tone: "hot" };
  }
  return { grade: "B", state: "눌림대기", action: "관찰", tone: "wait" };
}

async function fetchClosePrice(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?interval=1d&range=1mo`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Yahoo response not ok for ${ticker}`);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const closes = quote?.close || [];
  const timestamps = result?.timestamp || [];

  let idx = closes.length - 1;
  while (idx >= 0 && !Number.isFinite(closes[idx])) {
    idx -= 1;
  }
  if (idx < 0) {
    throw new Error(`No close price for ${ticker}`);
  }

  let prev = Number.NaN;
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (Number.isFinite(closes[i])) {
      prev = closes[i];
      break;
    }
  }
  if (!Number.isFinite(prev)) prev = closes[idx];

  return {
    close: closes[idx],
    previous: prev,
    asOf: toIsoDate((timestamps[idx] || 0) * 1000)
  };
}

async function fetchHistory(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?interval=1d&range=6mo`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Yahoo response not ok for ${ticker}`);
  const data = await response.json();
  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const closes = Array.isArray(quote?.close) ? quote.close : [];
  const highs = Array.isArray(quote?.high) ? quote.high : [];
  const lows = Array.isArray(quote?.low) ? quote.low : [];
  const volumes = Array.isArray(quote?.volume) ? quote.volume : [];

  const packed = [];
  for (let i = 0; i < closes.length; i += 1) {
    const c = closes[i];
    const h = highs[i];
    const l = lows[i];
    const v = volumes[i];
    if (!Number.isFinite(c) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(v)) continue;
    packed.push({ c, h, l, v });
  }
  if (packed.length < 80) throw new Error(`insufficient history for ${ticker}`);
  return {
    closes: packed.map((x) => x.c),
    highs: packed.map((x) => x.h),
    lows: packed.map((x) => x.l),
    volumes: packed.map((x) => x.v)
  };
}

async function handleApiQuotes(req, res, urlObj) {
  const symbolsRaw = urlObj.searchParams.get("symbols") || "";
  const symbols = symbolsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!symbols.length) {
    sendJson(res, 400, { error: "symbols query is required" });
    return;
  }

  try {
    const settled = await Promise.allSettled(symbols.map((ticker) => fetchClosePrice(ticker)));
    const prices = {};
    let newestAsOf = "";

    settled.forEach((item, index) => {
      const ticker = symbols[index];
      if (item.status !== "fulfilled") return;
      prices[ticker] = item.value.close;
      if (!newestAsOf || item.value.asOf > newestAsOf) {
        newestAsOf = item.value.asOf;
      }
    });

    sendJson(res, 200, {
      source: "yahoo-chart-close",
      asOf: newestAsOf || "-",
      prices
    });
  } catch {
    sendJson(res, 500, { error: "failed to load close prices" });
  }
}

async function handleApiTicker(req, res) {
  const tickerSources = [
    { label: "KOSPI", symbol: "^KS11", digits: 2 },
    { label: "KOSDAQ", symbol: "^KQ11", digits: 2 },
    { label: "DOW", symbol: "^DJI", digits: 2 },
    { label: "S&P 500", symbol: "^GSPC", digits: 2 },
    { label: "Dollar Index", symbol: "DX-Y.NYB", digits: 2 },
    { label: "NASDAQ 100", symbol: "^NDX", digits: 2 },
    { label: "USD/KRW", symbol: "KRW=X", digits: 2 },
    { label: "VIX", symbol: "^VIX", digits: 2 },
    { label: "US 10Y", symbol: "^TNX", digits: 2, valueDivisor: 10, isPercentSuffix: true, isPercentPointDelta: true }
  ];

  try {
    const settled = await Promise.allSettled(
      tickerSources.map((source) => fetchClosePrice(source.symbol))
    );
    const items = [];
    let newestAsOf = "";

    settled.forEach((result, index) => {
      const source = tickerSources[index];
      if (result.status !== "fulfilled") return;
      const latest = result.value.close;
      const previous = result.value.previous;
      const asOf = result.value.asOf;
      const normalizedLatest = source.valueDivisor ? latest / source.valueDivisor : latest;
      const normalizedPrevious = source.valueDivisor ? previous / source.valueDivisor : previous;
      const delta = formatTickerDelta(normalizedLatest, normalizedPrevious, {
        digits: 2,
        isPercentPoint: source.isPercentPointDelta
      });

      items.push({
        label: source.label,
        value: `${formatTickerValue(normalizedLatest, source.digits)}${source.isPercentSuffix ? "%" : ""}`,
        delta: delta.text,
        direction: delta.direction
      });

      if (!newestAsOf || asOf > newestAsOf) newestAsOf = asOf;
    });

    sendJson(res, 200, {
      updatedAt: newestAsOf || "-",
      items
    });
  } catch {
    sendJson(res, 500, { error: "failed to load ticker data" });
  }
}

async function handleApiTiming(req, res, urlObj) {
  const symbolsRaw = urlObj.searchParams.get("symbols") || "";
  const symbols = symbolsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 250);

  if (!symbols.length) {
    sendJson(res, 400, { error: "symbols query is required" });
    return;
  }

  const settled = await Promise.allSettled(symbols.map((ticker) => fetchHistory(ticker)));
  const result = {};

  settled.forEach((entry, idx) => {
    const ticker = symbols[idx];
    if (entry.status !== "fulfilled") return;
    const { closes, highs, lows, volumes } = entry.value;
    const close = closes[closes.length - 1];
    const ma20 = sma(closes, 20);
    const ma60 = sma(closes, 60);
    const rsi14 = rsi(closes, 14);
    const stoch = stochastic(highs, lows, closes, 14, 3);
    const macdValue = macd(closes, 12, 26, 9);
    const avgVol20 = sma(volumes, 20);
    const volNow = volumes[volumes.length - 1];
    const volumeRatio20 = Number.isFinite(avgVol20) && avgVol20 > 0 ? volNow / avgVol20 : Number.NaN;
    const timing = classifyTiming({
      close,
      ma20,
      ma60,
      rsi14,
      stochK: stoch.k,
      stochD: stoch.d,
      macdLine: macdValue.macdLine,
      macdSignal: macdValue.signalLine,
      volumeRatio20
    });

    result[ticker] = {
      ...timing,
      metrics: {
        close,
        ma20,
        ma60,
        rsi14,
        stochK: stoch.k,
        stochD: stoch.d,
        macdLine: macdValue.macdLine,
        macdSignal: macdValue.signalLine,
        macdHistogram: macdValue.histogram,
        volumeRatio20
      }
    };
  });

  sendJson(res, 200, {
    updatedAt: new Date().toISOString(),
    source: "yahoo-chart-6mo",
    timingBySymbol: result
  });
}

function safeResolvePath(urlPathname) {
  const cleanPath = decodeURIComponent(urlPathname.split("?")[0]).replace(/^\/+/, "");
  const requested = cleanPath === "" ? "index.html" : cleanPath;
  const absPath = path.resolve(__dirname, requested);
  if (!absPath.startsWith(__dirname)) return null;
  return absPath;
}

async function serveStatic(req, res, urlObj) {
  const absPath = safeResolvePath(urlObj.pathname);
  if (!absPath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const info = await stat(absPath);
    const filePath = info.isDirectory() ? path.join(absPath, "index.html") : absPath;
    const ext = path.extname(filePath).toLowerCase();
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && urlObj.pathname === "/api/quotes") {
    await handleApiQuotes(req, res, urlObj);
    return;
  }
  if (req.method === "GET" && urlObj.pathname === "/api/ticker") {
    await handleApiTicker(req, res);
    return;
  }
  if (req.method === "GET" && urlObj.pathname === "/api/timing") {
    await handleApiTiming(req, res, urlObj);
    return;
  }
  await serveStatic(req, res, urlObj);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
