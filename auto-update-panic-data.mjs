import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "panic-data.json");
const dataJsPath = path.join(__dirname, "panic-data.js");
const tickerDataPath = path.join(__dirname, "ticker-data.json");
const tickerDataJsPath = path.join(__dirname, "ticker-data.js");

function nowKstString() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const min = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${min} KST`;
}

function toNumber(text) {
  const cleaned = String(text ?? "").replace(/[^0-9.+-]/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function decimalPlaces(text, fallback = 2) {
  const cleaned = String(text ?? "").replace(/[^0-9.]/g, "");
  const match = cleaned.match(/\.(\d+)/);
  if (!match) return fallback;
  return match[1].length;
}

function precisionById(id, fallback) {
  if (id === "fng") return 0;
  if (id === "hy") return 2;
  return fallback;
}

function formatValue(value, prevText, isPercent = false, digits = 2) {
  return `${value.toFixed(digits)}${isPercent ? "%" : ""}`;
}

function formatDelta(now, prev, isPercent = false, digits = 2) {
  if (!Number.isFinite(now) || !Number.isFinite(prev)) return "-";
  const diff = now - prev;
  if (diff === 0) return `➡️ 0${isPercent ? "%" : ""}`;
  const icon = diff > 0 ? "📈" : "📉";
  const sign = diff > 0 ? "+" : "-";
  const abs = Math.abs(diff);
  const rounded = abs.toFixed(digits);
  if (Number.parseFloat(rounded) === 0) return `➡️ 0${isPercent ? "%" : ""}`;
  return `${icon} ${sign}${rounded}${isPercent ? "%" : ""}`;
}

function toneAndStatusById(id, value) {
  if (!Number.isFinite(value)) return { tone: "watch", status: "🟡 점검 필요" };

  if (id === "vix") {
    if (value < 20) return { tone: "stable", status: "🟢 안정" };
    if (value < 28) return { tone: "watch", status: "🟡 주의" };
    return { tone: "alert", status: "🔴 위험" };
  }

  if (id === "fng") {
    if (value >= 75) return { tone: "watch", status: "🟡 탐욕" };
    if (value <= 25) return { tone: "alert", status: "🔴 공포" };
    return { tone: "stable", status: "🟢 중립" };
  }

  if (id === "skew") {
    if (value >= 145) return { tone: "alert", status: "🔴 위험" };
    if (value >= 135) return { tone: "watch", status: "🟡 주의" };
    return { tone: "stable", status: "🟢 안정" };
  }

  if (id === "hy") {
    if (value < 4) return { tone: "stable", status: "🟢 안정" };
    if (value <= 5) return { tone: "watch", status: "🟡 주의" };
    return { tone: "alert", status: "🔴 위험" };
  }

  if (id === "move") {
    if (value < 110) return { tone: "stable", status: "🟢 안정" };
    if (value <= 130) return { tone: "watch", status: "🟡 주의" };
    return { tone: "alert", status: "🔴 위험" };
  }

  if (id === "vxn") {
    if (value < 25) return { tone: "stable", status: "🟢 안정" };
    if (value <= 35) return { tone: "watch", status: "🟡 주의" };
    return { tone: "alert", status: "🔴 위험" };
  }

  return { tone: null, status: null };
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "yds-investment-insights-bot/1.0" }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

async function fetchYahooLatestTwo(symbol, options = {}) {
  const range = options.range || "1mo";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(range)}`;
  const json = await fetchJson(url);
  const result = json?.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close;
  const timestamps = result?.timestamp;

  if (!Array.isArray(closes) || !Array.isArray(timestamps) || closes.length !== timestamps.length) {
    throw new Error(`yahoo rows invalid: ${symbol}`);
  }

  const pairs = [];
  for (let i = 0; i < closes.length; i += 1) {
    const close = closes[i];
    const ts = timestamps[i];
    if (!Number.isFinite(close) || !Number.isFinite(ts)) continue;
    pairs.push({ close, ts });
  }
  if (pairs.length < 2) throw new Error(`yahoo rows insufficient: ${symbol}`);

  return {
    latest: pairs[pairs.length - 1].close,
    previous: pairs[pairs.length - 2].close,
    latestDate: pairs[pairs.length - 1].ts,
    previousDate: pairs[pairs.length - 2].ts
  };
}

async function fetchFredLatestTwo(seriesId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const csv = await fetchText(url);
  const lines = csv.trim().split(/\r?\n/).slice(1);
  const values = [];

  for (const line of lines) {
    const parts = line.split(",");
    if (!parts[1] || parts[1] === ".") continue;
    const num = Number.parseFloat(parts[1]);
    if (Number.isFinite(num)) values.push(num);
  }

  if (values.length < 2) throw new Error(`fred rows insufficient: ${seriesId}`);
  return { latest: values[values.length - 1], previous: values[values.length - 2] };
}

async function fetchCnnFearGreed() {
  const url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
  const json = await fetchJson(url);
  const now = json?.fear_and_greed?.score;
  const previous = json?.fear_and_greed?.previous_close;

  if (!Number.isFinite(now) || !Number.isFinite(previous)) {
    throw new Error("invalid CNN Fear&Greed payload");
  }
  return { latest: now, previous };
}

function applyUpdate(item, latest, previous) {
  const isPercent = String(item.value || "").includes("%");
  const baseDigits = decimalPlaces(item.value, isPercent ? 2 : 2);
  const digits = precisionById(item.id, baseDigits);
  item.value = formatValue(latest, item.value, isPercent, digits);
  item.delta = formatDelta(latest, previous, isPercent, digits);

  const nextState = toneAndStatusById(item.id, latest);
  if (nextState.tone) item.tone = nextState.tone;
  if (nextState.status) item.status = nextState.status;
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

function deltaPercent(latest, previous) {
  if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous === 0) return null;
  return ((latest - previous) / previous) * 100;
}

async function main() {
  const raw = await readFile(dataPath, "utf8");
  const data = JSON.parse(raw);
  const items = Array.isArray(data.items) ? data.items : [];

  const byId = new Map(items.map((item) => [item.id, item]));
  const logs = [];

  const tasks = [
    {
      id: "vix",
      run: () => fetchYahooLatestTwo("^VIX")
    },
    {
      id: "fng",
      run: () => fetchCnnFearGreed()
    },
    {
      id: "skew",
      run: () => fetchYahooLatestTwo("^SKEW")
    },
    {
      id: "hy",
      run: () => fetchFredLatestTwo("BAMLH0A0HYM2")
    },
    {
      id: "move",
      run: () => fetchYahooLatestTwo("^MOVE")
    },
    {
      id: "vxn",
      run: () => fetchYahooLatestTwo("^VXN")
    }
  ];

  for (const task of tasks) {
    const item = byId.get(task.id);
    if (!item) continue;

    try {
      const { latest, previous } = await task.run();
      applyUpdate(item, latest, previous);
      logs.push(`[OK] ${task.id} updated`);
    } catch (err) {
      logs.push(`[SKIP] ${task.id} ${err.message}`);
    }
  }

  data.updatedAt = `${nowKstString()} (자동 업데이트)`;
  const jsonText = `${JSON.stringify(data, null, 2)}\n`;
  const jsText = `window.PANIC_DATA = ${JSON.stringify(data, null, 2)};\n`;
  await writeFile(dataPath, jsonText, "utf8");
  await writeFile(dataJsPath, jsText, "utf8");

  const tickerSources = [
    { label: "KOSPI", symbol: "^KS11", digits: 2 },
    { label: "KOSDAQ", symbol: "^KQ11", digits: 2 },
    { label: "DOW", symbol: "^DJI", digits: 2 },
    { label: "S&P 500", symbol: "^GSPC", digits: 2 },
    { label: "NASDAQ Composite", symbol: "^IXIC", digits: 2 },
    { label: "NASDAQ 100", symbol: "^NDX", digits: 2 },
    { label: "USD/KRW", symbol: "KRW=X", digits: 2 },
    { label: "US 10Y", symbol: "^TNX", digits: 2, valueDivisor: 10, isPercentSuffix: true, isPercentPointDelta: true }
  ];

  const tickerItems = [];
  for (const source of tickerSources) {
    try {
      let { latest, previous } = await fetchYahooLatestTwo(source.symbol);
      let pct = deltaPercent(latest, previous);

      // 지수형 자산은 시점 불일치로 튀는 값이 간헐적으로 나와, 비정상 수치면 넓은 range로 재조회
      const needsSanityCheck =
        source.label === "DOW" ||
        source.label === "S&P 500" ||
        source.label === "NASDAQ Composite" ||
        source.label === "NASDAQ 100";
      const isOutlier = needsSanityCheck && pct !== null && Math.abs(pct) > 8;
      if (isOutlier) {
        const retried = await fetchYahooLatestTwo(source.symbol, { range: "6mo" });
        latest = retried.latest;
        previous = retried.previous;
        pct = deltaPercent(latest, previous);
      }

      const normalizedLatest = source.valueDivisor ? latest / source.valueDivisor : latest;
      const normalizedPrevious = source.valueDivisor ? previous / source.valueDivisor : previous;
      const delta = formatTickerDelta(normalizedLatest, normalizedPrevious, {
        digits: 2,
        isPercentPoint: source.isPercentPointDelta
      });
      tickerItems.push({
        label: source.label,
        value: `${formatTickerValue(normalizedLatest, source.digits)}${source.isPercentSuffix ? "%" : ""}`,
        delta: delta.text,
        direction: delta.direction
      });
      logs.push(`[OK] ticker ${source.label} updated (${pct !== null ? pct.toFixed(2) + "%" : "-"})`);
    } catch (err) {
      logs.push(`[SKIP] ticker ${source.label} ${err.message}`);
    }
  }

  const tickerData = {
    updatedAt: `${nowKstString()} (자동 업데이트)`,
    items: tickerItems
  };
  await writeFile(tickerDataPath, `${JSON.stringify(tickerData, null, 2)}\n`, "utf8");
  await writeFile(tickerDataJsPath, `window.TICKER_DATA = ${JSON.stringify(tickerData, null, 2)};\n`, "utf8");

  console.log("panic-data.json / panic-data.js 업데이트 완료");
  console.log("ticker-data.json / ticker-data.js 업데이트 완료");
  logs.forEach((log) => console.log(log));
  console.log("고정값(수동 유지): bofa, putcall, gsbb");
}

main().catch((err) => {
  console.error("실패:", err.message);
  process.exit(1);
});
