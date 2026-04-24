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
    { label: "S&P 500", symbol: "^GSPC", digits: 2 },
    { label: "NASDAQ 100", symbol: "^NDX", digits: 2 },
    { label: "USD/KRW", symbol: "KRW=X", digits: 2 },
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
  await serveStatic(req, res, urlObj);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
