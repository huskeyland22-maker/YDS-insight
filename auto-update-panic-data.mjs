import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "panic-data.json");
const dataJsPath = path.join(__dirname, "panic-data.js");
const tickerDataPath = path.join(__dirname, "ticker-data.json");
const tickerDataJsPath = path.join(__dirname, "ticker-data.js");
const overseasDataPath = path.join(__dirname, "overseas-data.json");
const overseasDataJsPath = path.join(__dirname, "overseas-data.js");

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

async function fetchYahooSeries(symbol, options = {}) {
  const range = options.range || "1y";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(range)}`;
  const json = await fetchJson(url);
  const result = json?.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close;
  const timestamps = result?.timestamp;
  if (!Array.isArray(closes) || !Array.isArray(timestamps) || closes.length !== timestamps.length) {
    throw new Error(`yahoo series invalid: ${symbol}`);
  }

  const rows = [];
  for (let i = 0; i < closes.length; i += 1) {
    const close = closes[i];
    const ts = timestamps[i];
    if (!Number.isFinite(close) || !Number.isFinite(ts)) continue;
    rows.push({ close, ts });
  }
  if (rows.length < 22) {
    throw new Error(`yahoo series insufficient: ${symbol}`);
  }
  return rows;
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

function formatSignedPctOrDash(value) {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function formatNumberOrDash(value, digits = 2) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

async function main() {
  let previousOverseasData = null;
  try {
    previousOverseasData = JSON.parse(await readFile(overseasDataPath, "utf8"));
  } catch (err) {
    previousOverseasData = null;
  }

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

  const overseasSources = [
    { symbol: "SOXL", range: "1y" },
    { symbol: "TQQQ", range: "1y" },
    { symbol: "SSO", range: "1y" }
  ];
  const overseasItems = [];
  for (const source of overseasSources) {
    try {
      const rows = await fetchYahooSeries(source.symbol, { range: source.range });
      const latest = rows[rows.length - 1].close;
      const idx1w = Math.max(0, rows.length - 6);
      const idx1m = Math.max(0, rows.length - 22);
      const close1w = rows[idx1w].close;
      const close1m = rows[idx1m].close;
      const oneDay = rows.length > 1 ? deltaPercent(latest, rows[rows.length - 2].close) : null;
      const oneWeek = deltaPercent(latest, close1w);
      const oneMonth = deltaPercent(latest, close1m);
      const peak = rows.reduce((acc, row) => (row.close > acc ? row.close : acc), Number.NEGATIVE_INFINITY);
      const mdd = Number.isFinite(peak) && peak > 0 ? ((latest - peak) / peak) * 100 : null;

      overseasItems.push({
        symbol: source.symbol,
        p1d: formatSignedPctOrDash(oneDay),
        p1w: formatSignedPctOrDash(oneWeek),
        p1m: formatSignedPctOrDash(oneMonth),
        mdd: formatSignedPctOrDash(mdd),
        updatedAt: nowKstString().slice(0, 10).replace(/\./g, ".")
      });
      logs.push(`[OK] overseas ${source.symbol} updated`);
    } catch (err) {
      logs.push(`[SKIP] overseas ${source.symbol} ${err.message}`);
    }
  }

  const overseasData = {
    updatedAt: `${nowKstString()} (자동 업데이트)`,
    items: overseasItems,
    flow: {
      updatedAt: `${nowKstString()} (자동 업데이트)`,
      items: []
    },
    insight: {
      sectorStrength: [],
      weeklySummary: []
    }
  };

  try {
    const usdJpy = await fetchYahooLatestTwo("JPY=X");
    overseasData.flow.items.push({
      id: "usdjpy",
      label: "엔캐리 압력",
      value: `USDJPY ${formatNumberOrDash(usdJpy.latest, 2)}`,
      delta: formatSignedPctOrDash(deltaPercent(usdJpy.latest, usdJpy.previous)),
      tone: deltaPercent(usdJpy.latest, usdJpy.previous) > 0.6 ? "down" : "up"
    });
    logs.push("[OK] flow usdjpy updated");
  } catch (err) {
    logs.push(`[SKIP] flow usdjpy ${err.message}`);
  }

  try {
    const dxy = await fetchYahooLatestTwo("DX-Y.NYB");
    overseasData.flow.items.push({
      id: "dxy",
      label: "달러 유동성",
      value: `DXY ${formatNumberOrDash(dxy.latest, 2)}`,
      delta: formatSignedPctOrDash(deltaPercent(dxy.latest, dxy.previous)),
      tone: deltaPercent(dxy.latest, dxy.previous) > 0.4 ? "down" : "up"
    });
    logs.push("[OK] flow dxy updated");
  } catch (err) {
    logs.push(`[SKIP] flow dxy ${err.message}`);
  }

  try {
    const qqq = await fetchYahooLatestTwo("QQQ");
    const tlt = await fetchYahooLatestTwo("TLT");
    const ratioNow = Number.isFinite(qqq.latest) && Number.isFinite(tlt.latest) && tlt.latest !== 0 ? qqq.latest / tlt.latest : null;
    const ratioPrev = Number.isFinite(qqq.previous) && Number.isFinite(tlt.previous) && tlt.previous !== 0 ? qqq.previous / tlt.previous : null;
    const ratioDelta = deltaPercent(ratioNow, ratioPrev);
    overseasData.flow.items.push({
      id: "qqq_tlt",
      label: "기관 프록시",
      value: `QQQ/TLT ${formatNumberOrDash(ratioNow, 3)}`,
      delta: formatSignedPctOrDash(ratioDelta),
      tone: ratioDelta >= 0 ? "up" : "down"
    });
    logs.push("[OK] flow qqq_tlt updated");
  } catch (err) {
    logs.push(`[SKIP] flow qqq_tlt ${err.message}`);
  }

  try {
    const hyg = await fetchYahooLatestTwo("HYG");
    const lqd = await fetchYahooLatestTwo("LQD");
    const ratioNow = Number.isFinite(hyg.latest) && Number.isFinite(lqd.latest) && lqd.latest !== 0 ? hyg.latest / lqd.latest : null;
    const ratioPrev = Number.isFinite(hyg.previous) && Number.isFinite(lqd.previous) && lqd.previous !== 0 ? hyg.previous / lqd.previous : null;
    const ratioDelta = deltaPercent(ratioNow, ratioPrev);
    overseasData.flow.items.push({
      id: "hyg_lqd",
      label: "신용 체력",
      value: `HYG/LQD ${formatNumberOrDash(ratioNow, 3)}`,
      delta: formatSignedPctOrDash(ratioDelta),
      tone: ratioDelta >= 0 ? "up" : "down"
    });
    logs.push("[OK] flow hyg_lqd updated");
  } catch (err) {
    logs.push(`[SKIP] flow hyg_lqd ${err.message}`);
  }

  try {
    const vixItem = byId.get("vix");
    const hyItem = byId.get("hy");
    const vixValue = toNumber(vixItem && vixItem.value);
    const hyValue = toNumber(hyItem && hyItem.value);
    const vixDelta = parseFloat(String(vixItem && vixItem.delta || "").replace(/[^0-9.+-]/g, ""));
    const hyDelta = parseFloat(String(hyItem && hyItem.delta || "").replace(/[^0-9.+-]/g, ""));
    const stress = (Number.isFinite(vixValue) ? vixValue : 22) + (Number.isFinite(hyValue) ? hyValue * 3 : 12);
    overseasData.flow.items.push({
      id: "vix_hy",
      label: "리스크 선호",
      value: `VIX ${formatNumberOrDash(vixValue, 2)} / HY ${formatNumberOrDash(hyValue, 2)}%`,
      delta: `VIX ${formatSignedPctOrDash(vixDelta)} · HY ${formatSignedPctOrDash(hyDelta)}`,
      tone: stress <= 30 ? "up" : stress >= 35 ? "down" : "flat"
    });
    logs.push("[OK] flow vix_hy updated");
  } catch (err) {
    logs.push(`[SKIP] flow vix_hy ${err.message}`);
  }

  {
    const flowItems = Array.isArray(overseasData.flow.items) ? overseasData.flow.items : [];
    let score = 50;
    flowItems.forEach((item) => {
      if (!item) return;
      if (item.tone === "up") score += 8;
      else if (item.tone === "down") score -= 8;
    });
    if (score > 100) score = 100;
    if (score < 0) score = 0;
    const regime = score >= 62 ? "Risk-on" : score <= 38 ? "Risk-off" : "Neutral";
    const action =
      regime === "Risk-on"
        ? "성장/섹터 ETF는 눌림 분할 접근"
        : regime === "Risk-off"
          ? "현금/헤지 비중 우선, 레버리지 축소"
          : "중립 비중 유지, 이벤트 확인 후 대응";
    const dateKey = nowKstString().slice(0, 10);
    const prevHistory =
      previousOverseasData &&
      previousOverseasData.flow &&
      previousOverseasData.flow.regime &&
      Array.isArray(previousOverseasData.flow.regime.history)
        ? previousOverseasData.flow.regime.history
        : [];
    let history = prevHistory
      .map((entry) => ({
        d: String(entry && entry.d ? entry.d : ""),
        s: Number(entry && entry.s)
      }))
      .filter((entry) => /^\d{4}\.\d{2}\.\d{2}$/.test(entry.d) && Number.isFinite(entry.s));
    if (history.length && history[history.length - 1].d === dateKey) {
      history[history.length - 1].s = Math.round(score);
    } else {
      history.push({ d: dateKey, s: Math.round(score) });
    }
    if (history.length > 7) history = history.slice(history.length - 7);
    overseasData.flow.regime = {
      score: Math.round(score),
      state: regime,
      action,
      history
    };
  }

  {
    const sectorDefs = [
      { id: "semiconductor", label: "반도체", symbol: "SOXX" },
      { id: "ai-growth", label: "AI/성장", symbol: "QQQ" },
      { id: "financials", label: "금융", symbol: "XLF" },
      { id: "energy", label: "에너지", symbol: "XLE" }
    ];
    const sectorStrength = [];
    for (const sector of sectorDefs) {
      try {
        const latestTwo = await fetchYahooLatestTwo(sector.symbol);
        const oneDay = deltaPercent(latestTwo.latest, latestTwo.previous);
        const series = await fetchYahooSeries(sector.symbol, { range: "6mo" });
        const latest = series[series.length - 1].close;
        const idx1w = Math.max(0, series.length - 6);
        const idx1m = Math.max(0, series.length - 22);
        const oneWeek = deltaPercent(latest, series[idx1w].close);
        const oneMonth = deltaPercent(latest, series[idx1m].close);
        const composite =
          (Number.isFinite(oneDay) ? oneDay * 0.2 : 0) +
          (Number.isFinite(oneWeek) ? oneWeek * 0.35 : 0) +
          (Number.isFinite(oneMonth) ? oneMonth * 0.45 : 0);
        sectorStrength.push({
          id: sector.id,
          label: sector.label,
          symbol: sector.symbol,
          p1d: formatSignedPctOrDash(oneDay),
          p1w: formatSignedPctOrDash(oneWeek),
          p1m: formatSignedPctOrDash(oneMonth),
          score: Math.round(composite * 10) / 10
        });
        logs.push(`[OK] sector ${sector.symbol} updated`);
      } catch (err) {
        logs.push(`[SKIP] sector ${sector.symbol} ${err.message}`);
      }
    }
    sectorStrength.sort((a, b) => b.score - a.score);
    overseasData.insight.sectorStrength = sectorStrength;

    const regime = overseasData.flow && overseasData.flow.regime ? overseasData.flow.regime : null;
    const top = sectorStrength[0] || null;
    const bottom = sectorStrength.length > 1 ? sectorStrength[sectorStrength.length - 1] : null;
    const weeklySummary = [];
    if (regime) {
      weeklySummary.push(
        `국면: ${regime.state} (${regime.score}/100) · ${regime.action}`
      );
    }
    if (top) {
      weeklySummary.push(
        `강세 섹터: ${top.label}(${top.symbol}) ${top.p1w} / ${top.p1m}`
      );
    }
    if (bottom) {
      weeklySummary.push(
        `약세 섹터: ${bottom.label}(${bottom.symbol}) ${bottom.p1w} / ${bottom.p1m}`
      );
    }
    overseasData.insight.weeklySummary = weeklySummary;
  }
  await writeFile(overseasDataPath, `${JSON.stringify(overseasData, null, 2)}\n`, "utf8");
  await writeFile(overseasDataJsPath, `window.OVERSEAS_DATA = ${JSON.stringify(overseasData, null, 2)};\n`, "utf8");

  console.log("panic-data.json / panic-data.js 업데이트 완료");
  console.log("ticker-data.json / ticker-data.js 업데이트 완료");
  console.log("overseas-data.json / overseas-data.js 업데이트 완료");
  logs.forEach((log) => console.log(log));
  console.log("고정값(수동 유지): bofa, putcall, gsbb");
}

main().catch((err) => {
  console.error("실패:", err.message);
  process.exit(1);
});
