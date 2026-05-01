/**
 * scripts/fetch.js — data/panic.json 갱신 (overwrite)
 * panic-data.json의 previousClose·change 기반으로 { now, prev } 구조 생성
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "data");
const outPath = path.join(outDir, "panic.json");
const marketPath = path.join(outDir, "market.json");
const panicPath = path.join(root, "panic-data.json");
const tickerPath = path.join(root, "ticker-data.json");
const overseasPath = path.join(root, "overseas-data.json");

function round2(x) {
  return Math.round(Number(x) * 100) / 100;
}

function parseNum(text) {
  const cleaned = String(text ?? "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function kstUpdatedAt() {
  const s = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul", hour12: false });
  return s.replace("T", " ").slice(0, 16);
}

function valById(items, id) {
  const it = items.find((x) => x && x.id === id);
  return it ? parseNum(it.value) : null;
}

function pairFromItem(items, id) {
  const it = items.find((x) => x && x.id === id);
  if (!it) return { now: null, prev: null };
  const now = parseNum(it.value);
  let prev =
    it.previousClose !== undefined && it.previousClose !== null && it.previousClose !== ""
      ? Number(it.previousClose)
      : null;
  if (!Number.isFinite(prev) && Number.isFinite(now) && it.change !== undefined && it.change !== null) {
    const ch = Number(it.change);
    if (Number.isFinite(ch)) prev = round2(now - ch);
  }
  if (!Number.isFinite(prev) && Number.isFinite(now)) prev = now;
  if (Number.isFinite(prev)) prev = round2(prev);
  const out = { now: Number.isFinite(now) ? round2(now) : null, prev: Number.isFinite(prev) ? prev : null };
  if (it.prev2 !== undefined && it.prev2 !== null && it.prev2 !== "") {
    const p2 = Number(it.prev2);
    if (Number.isFinite(p2)) out.prev2 = round2(p2);
  }
  return out;
}

function readDxy(overseas) {
  const items = overseas?.flow?.items;
  if (!Array.isArray(items)) return null;
  const row = items.find((x) => x && x.id === "dxy");
  const m = String(row?.value ?? "").match(/([\d.]+)/);
  return m ? round2(parseFloat(m[1])) : null;
}

function tickerByLabel(ticker, label) {
  const items = ticker?.items;
  if (!Array.isArray(items)) return null;
  return items.find((x) => x && x.label === label) || null;
}

function pctOrPointsFromDelta(deltaStr) {
  const s = String(deltaStr ?? "");
  const cleaned = s.replace(/%p/gi, "").replace(/%/g, "").replace(/[^0-9.\-+]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? round2(n) : null;
}

function panicItemById(panic, id) {
  const items = panic?.items;
  if (!Array.isArray(items)) return null;
  return items.find((x) => x && x.id === id) || null;
}

function vixPointChange(it) {
  if (!it) return null;
  if (it.change !== undefined && it.change !== null && it.change !== "") {
    const c = Number(it.change);
    if (Number.isFinite(c)) return round2(c);
  }
  const d = String(it.delta || "");
  const n = parseFloat(d.replace(/[^0-9.\-+]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (d.indexOf("📉") !== -1) return round2(-Math.abs(n));
  if (d.indexOf("📈") !== -1) return round2(Math.abs(n));
  return round2(n);
}

function buildMarketSnapshot(panic, ticker) {
  const dow = tickerByLabel(ticker, "DOW");
  const sp = tickerByLabel(ticker, "S&P 500");
  const ixic = tickerByLabel(ticker, "NASDAQ Composite");
  const ndx = tickerByLabel(ticker, "NASDAQ 100");
  const us10 = tickerByLabel(ticker, "US 10Y");
  const vixIt = panicItemById(panic, "vix");

  return {
    dow: { value: parseNum(dow?.value), change: pctOrPointsFromDelta(dow?.delta) },
    sp500: { value: parseNum(sp?.value), change: pctOrPointsFromDelta(sp?.delta) },
    nasdaq: { value: parseNum(ixic?.value), change: pctOrPointsFromDelta(ixic?.delta) },
    nasdaq100: { value: parseNum(ndx?.value), change: pctOrPointsFromDelta(ndx?.delta) },
    vix: { value: parseNum(vixIt?.value), change: vixPointChange(vixIt) },
    us10y: { value: parseNum(us10?.value), change: pctOrPointsFromDelta(us10?.delta) },
    updatedAt: kstUpdatedAt()
  };
}

function pairUs10y(ticker) {
  const row = ticker?.items?.find((x) => x && x.label === "US 10Y");
  if (!row) return { now: null, prev: null };
  const now = parseNum(row.value);
  let prev =
    row.previousClose !== undefined && row.previousClose !== null && row.previousClose !== ""
      ? Number(row.previousClose)
      : null;
  if (!Number.isFinite(prev) && Number.isFinite(now) && row.change !== undefined && row.change !== null) {
    const ch = Number(row.change);
    if (Number.isFinite(ch)) prev = round2(now - ch);
  }
  if (!Number.isFinite(prev) && Number.isFinite(now)) prev = now;
  if (Number.isFinite(prev)) prev = round2(prev);
  return {
    now: Number.isFinite(now) ? round2(now) : null,
    prev: Number.isFinite(prev) ? prev : null
  };
}

const MOCK = {
  vix: { now: 28, prev: 26.5, prev2: 30 },
  putCall: { now: 1.1, prev: 1.05 },
  fearGreed: { now: 30, prev: 38 },
  bofa: { now: 3.5, prev: 3.4 },
  highYield: { now: 4.8, prev: 4.75 },
  liquidity: { now: -1.5, prev: -1.45 },
  dollar: 106,
  yieldCurve: -0.8,
  rate: { now: 4.5, prev: 4.48 }
};

function buildFromSources() {
  const panic = readJsonSafe(panicPath);
  const items = Array.isArray(panic?.items) ? panic.items : null;
  if (!items) return null;

  const ticker = readJsonSafe(tickerPath);
  const overseas = readJsonSafe(overseasPath);

  const moveP = pairFromItem(items, "move");
  const liqNow = Number.isFinite(moveP.now) ? round2(-(moveP.now / 45)) : null;
  const liqPrev = Number.isFinite(moveP.prev) ? round2(-(moveP.prev / 45)) : liqNow;

  let yieldCurve = null;
  const extras = panic?.signalExtras;
  if (extras && extras.t10y2y !== null && extras.t10y2y !== undefined && extras.t10y2y !== "") {
    const yn = Number(extras.t10y2y);
    if (Number.isFinite(yn)) yieldCurve = round2(yn);
  }

  const out = {
    vix: pairFromItem(items, "vix"),
    putCall: pairFromItem(items, "putcall"),
    fearGreed: pairFromItem(items, "fng"),
    bofa: pairFromItem(items, "bofa"),
    highYield: pairFromItem(items, "hy"),
    liquidity: { now: liqNow, prev: liqPrev },
    dollar: readDxy(overseas),
    yieldCurve,
    rate: pairUs10y(ticker),
    updatedAt: kstUpdatedAt()
  };
  return out;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const built = buildFromSources();
  const payload = built ?? { ...MOCK, updatedAt: kstUpdatedAt() };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log("[fetch.js] wrote", outPath, "updatedAt=", payload.updatedAt);

  const panic = readJsonSafe(panicPath);
  const ticker = readJsonSafe(tickerPath);
  const market = buildMarketSnapshot(panic, ticker);
  fs.writeFileSync(marketPath, JSON.stringify(market, null, 2) + "\n", "utf8");
  console.log("[fetch.js] wrote", marketPath, "updatedAt=", market.updatedAt);
}

main();
