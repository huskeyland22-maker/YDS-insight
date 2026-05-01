/**
 * scripts/fetch.js — data/panic.json 갱신 (overwrite)
 * data/ticker.json — ticker-data.json·panic-data 기반 생성 (market 이전에 반드시 기록)
 * data/us-close-snapshot.json + data/us-close-snapshot.js — ticker+panic 기반 (동일 페이로드; .js는 file:// 로컬 열람용)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "data");
const outPath = path.join(outDir, "panic.json");
const usCloseSnapshotPath = path.join(outDir, "us-close-snapshot.json");
const usCloseSnapshotJsPath = path.join(outDir, "us-close-snapshot.js");
const tickerJsonPath = path.join(outDir, "ticker.json");
const panicPath = path.join(root, "panic-data.json");
const tickerPath = path.join(root, "ticker-data.json");
const overseasPath = path.join(root, "overseas-data.json");

/** true면 hasValidUpdate / 2차 슬롯과 무관하게 us-close-snapshot.json 항상 저장 */
const FETCH_FORCE_SAVE =
  String(process.env.FETCH_FORCE_SAVE || "")
    .trim()
    .toLowerCase() === "true" ||
  String(process.env.FETCH_FORCE_SAVE || "").trim() === "1";

function round2(x) {
  return Math.round(Number(x) * 100) / 100;
}

function hasNumeric(x) {
  return x !== null && x !== undefined && x !== "" && Number.isFinite(Number(x));
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

function readDxyChange(overseas) {
  const items = overseas?.flow?.items;
  if (!Array.isArray(items)) return null;
  const row = items.find((x) => x && x.id === "dxy");
  return pctOrPointsFromDelta(row?.delta);
}

function tickerByLabel(ticker, label) {
  const items = ticker?.items;
  if (!Array.isArray(items)) return null;
  return items.find((x) => x && x.label === label) || null;
}

function tickerByLabels(ticker, labels) {
  if (!Array.isArray(labels) || !labels.length) return null;
  for (const label of labels) {
    const row = tickerByLabel(ticker, label);
    if (row) return row;
  }
  return null;
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

function pickTickerItem(items, label) {
  if (!Array.isArray(items)) return null;
  return items.find((x) => x && x.label === label) || null;
}

/**
 * 루트 ticker-data.json + panic-data 기반으로 data/ticker.json용 배열 생성.
 * 실패 시 요청 예시와 동일한 기본 행 반환.
 */
async function fetchTicker() {
  const legacy = readJsonSafe(tickerPath);
  const panicFull = readJsonSafe(panicPath);
  const vixIt = panicItemById(panicFull, "vix");

  const rows = [];
  if (legacy && Array.isArray(legacy.items)) {
    const items = legacy.items;
    const push = (symbol, labels) => {
      const arr = Array.isArray(labels) ? labels : [labels];
      const it = arr.map((label) => pickTickerItem(items, label)).find(Boolean);
      if (!it) return;
      const price = parseNum(it.value);
      const change = pctOrPointsFromDelta(it.delta);
      rows.push({
        symbol,
        price: Number.isFinite(price) ? round2(price) : it.value,
        change: Number.isFinite(change) ? change : 0
      });
    };
    push("USDKRW", ["USD/KRW", "미국 USD"]);
    push("DOW", "DOW");
    push("SP500", "S&P 500");
    push("NASDAQ", "NASDAQ Composite");
    push("WTI", "WTI");
    push("GOLD", ["국제 금", "Gold"]);
    push("BITCOIN", ["비트코인", "Bitcoin"]);
    push("DXY", ["달러인덱스", "Dollar Index", "DXY"]);
    const u10 = pickTickerItem(items, "US 10Y");
    if (u10) {
      const price = parseNum(u10.value);
      const change = pctOrPointsFromDelta(u10.delta);
      rows.push({
        symbol: "US10Y",
        price: Number.isFinite(price) ? round2(price) : u10.value,
        change: Number.isFinite(change) ? change : 0
      });
    }
    if (vixIt) {
      const price = parseNum(vixIt.value);
      const ch = vixPointChange(vixIt);
      rows.push({
        symbol: "VIX",
        price: Number.isFinite(price) ? round2(price) : vixIt.value,
        change: Number.isFinite(ch) ? ch : 0
      });
    }
  }

  if (rows.length) {
    return rows;
  }

  const vixPrice = vixIt ? parseNum(vixIt.value) : null;
  const vixCh = vixIt ? vixPointChange(vixIt) : null;
  return [
    { symbol: "DOW", price: 48861.81, change: -0.57 },
    { symbol: "SP500", price: 7135.95, change: -0.04 },
    { symbol: "NASDAQ", price: 24673.24, change: 0.04 },
    { symbol: "NASDAQ100", price: 27186.98, change: 0.58 },
    {
      symbol: "VIX",
      price: Number.isFinite(vixPrice) ? round2(vixPrice) : 18.81,
      change: Number.isFinite(vixCh) ? vixCh : 0.98
    },
    { symbol: "US10Y", price: 0.44, change: 1.47 }
  ];
}

function formatDeltaFromNumber(changeNum, isUs10y) {
  if (!Number.isFinite(changeNum)) return "-";
  const abs = Math.abs(changeNum).toFixed(2);
  const suffix = isUs10y ? "%p" : "%";
  if (changeNum > 0) return "+" + abs + suffix;
  if (changeNum < 0) return "-" + abs + suffix;
  return "0.00" + suffix;
}

/** data/ticker.json 배열 → buildMarketSnapshot 호환 { items } */
function tickerCompactToLegacyTicker(rows) {
  if (!Array.isArray(rows) || !rows.length) return { items: [] };
  const SYM_TO_LABEL = {
    USDKRW: "USD/KRW",
    DOW: "DOW",
    SP500: "S&P 500",
    NASDAQ: "NASDAQ Composite",
    WTI: "WTI",
    GOLD: "국제 금",
    BITCOIN: "비트코인",
    DXY: "달러인덱스",
    US10Y: "US 10Y",
    VIX: "VIX"
  };
  const items = rows.map((r) => {
    const label = SYM_TO_LABEL[r.symbol] || String(r.symbol);
    const changeNum = Number(r.change);
    const direction = !Number.isFinite(changeNum) ? "flat" : changeNum > 0 ? "up" : changeNum < 0 ? "down" : "flat";
    const deltaStr = formatDeltaFromNumber(changeNum, r.symbol === "US10Y");
    const priceNum = typeof r.price === "number" ? r.price : parseNum(r.price);
    let valueStr;
    if (r.symbol === "US10Y" && Number.isFinite(priceNum)) {
      valueStr = priceNum.toFixed(2) + "%";
    } else if (Number.isFinite(priceNum)) {
      valueStr = priceNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      valueStr = String(r.price ?? "-");
    }
    return { label, value: valueStr, delta: deltaStr, direction };
  });
  return { items };
}

/** 스냅샷 계산용: data/ticker.json 우선, 없으면 루트 ticker-data.json */
function loadTickerForMarket() {
  const raw = readJsonSafe(tickerJsonPath);
  if (Array.isArray(raw) && raw.length) {
    return tickerCompactToLegacyTicker(raw);
  }
  if (raw && Array.isArray(raw.items) && raw.items.length && raw.items[0].symbol) {
    return tickerCompactToLegacyTicker(raw.items);
  }
  return readJsonSafe(tickerPath) || { items: [] };
}

function normalizeUs10y(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= 0 || n < 1) return null;
  return round2(n);
}

function buildMarketSnapshot(panic, ticker, overseas) {
  const usdkrw = tickerByLabels(ticker, ["USD/KRW", "미국 USD"]);
  const dow = tickerByLabel(ticker, "DOW");
  const sp = tickerByLabel(ticker, "S&P 500");
  const ixic = tickerByLabel(ticker, "NASDAQ Composite");
  const wti = tickerByLabels(ticker, ["WTI"]);
  const gold = tickerByLabels(ticker, ["국제 금", "Gold"]);
  const us10 = tickerByLabel(ticker, "US 10Y");
  const bitcoin = tickerByLabels(ticker, ["비트코인", "Bitcoin"]);
  const dxy = tickerByLabels(ticker, ["달러인덱스", "Dollar Index", "DXY"]);
  const vixIt = panicItemById(panic, "vix");
  const us10yValue = normalizeUs10y(parseNum(us10?.value));
  const us10yChange = us10yValue === null ? null : pctOrPointsFromDelta(us10?.delta);

  const dxyFromTicker = parseNum(dxy?.value);
  const dxyFallback = readDxy(overseas);
  const dxyValue = Number.isFinite(dxyFromTicker) ? dxyFromTicker : dxyFallback;
  const dxyFromTickerChange = pctOrPointsFromDelta(dxy?.delta);
  const dxyFallbackChange = readDxyChange(overseas);
  const dxyChange = Number.isFinite(dxyFromTickerChange) ? dxyFromTickerChange : dxyFallbackChange;

  return {
    usdkrw: { value: parseNum(usdkrw?.value), change: pctOrPointsFromDelta(usdkrw?.delta) },
    dow: { value: parseNum(dow?.value), change: pctOrPointsFromDelta(dow?.delta) },
    sp500: { value: parseNum(sp?.value), change: pctOrPointsFromDelta(sp?.delta) },
    nasdaq: { value: parseNum(ixic?.value), change: pctOrPointsFromDelta(ixic?.delta) },
    wti: { value: parseNum(wti?.value), change: pctOrPointsFromDelta(wti?.delta) },
    gold: { value: parseNum(gold?.value), change: pctOrPointsFromDelta(gold?.delta) },
    vix: { value: parseNum(vixIt?.value), change: vixPointChange(vixIt) },
    us10y: { value: us10yValue, change: us10yChange },
    bitcoin: { value: parseNum(bitcoin?.value), change: pctOrPointsFromDelta(bitcoin?.delta) },
    dxy: { value: dxyValue, change: dxyChange }
  };
}

function mergeMarketWithFallback(newData, oldData) {
  if (!oldData || typeof oldData !== "object") return newData;
  const merged = { ...(newData && typeof newData === "object" ? newData : {}) };
  const keys = ["usdkrw", "dow", "sp500", "nasdaq", "wti", "gold", "vix", "us10y", "bitcoin", "dxy"];
  for (const k of keys) {
    const cur = merged[k] && typeof merged[k] === "object" ? { ...merged[k] } : {};
    const old = oldData[k] && typeof oldData[k] === "object" ? oldData[k] : {};
    if (!hasNumeric(cur.value) && hasNumeric(old.value)) cur.value = Number(old.value);
    if (!hasNumeric(cur.change) && hasNumeric(old.change)) cur.change = Number(old.change);
    merged[k] = cur;
  }
  return merged;
}

/** 스냅샷 항목 value 안전 추출 */
function mv(data, key) {
  if (!data || typeof data !== "object") return undefined;
  const o = data[key];
  if (!o || typeof o !== "object") return undefined;
  const v = o.value;
  return v === undefined || v === null ? undefined : v;
}

/** market 스냅샷 항목의 등락(%)·포인트 */
function mc(data, key) {
  if (!data || typeof data !== "object") return undefined;
  const o = data[key];
  if (!o || typeof o !== "object") return undefined;
  const c = o.change;
  if (c === undefined || c === null || c === "") return undefined;
  const n = Number(c);
  return Number.isFinite(n) ? n : undefined;
}

function hasValidUpdate(newData, oldData) {
  if (!oldData) return true;

  const nd = newData && typeof newData === "object" ? newData : {};
  const od = oldData && typeof oldData === "object" ? oldData : {};

  const keys = ["usdkrw", "dow", "sp500", "nasdaq", "wti", "gold", "vix", "us10y", "bitcoin", "dxy"];
  for (const k of keys) {
    if (mv(nd, k) !== mv(od, k)) return true;
    if (mc(nd, k) !== mc(od, k)) return true;
  }

  return false;
}

function stripUpdatedAt(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const copy = { ...obj };
  delete copy.updatedAt;
  return copy;
}

function logMarketPayloads(newData, oldData) {
  const fresh = stripUpdatedAt(newData);
  const old = stripUpdatedAt(oldData) || {};
  console.log("=== NEW DATA ===");
  console.log(JSON.stringify(fresh, null, 2));
  console.log("=== OLD DATA ===");
  console.log(JSON.stringify(old, null, 2));
}

function logMarketFieldArrows(newData, oldData) {
  const od = oldData && typeof oldData === "object" ? oldData : {};
  console.log("USDKRW:", od?.usdkrw?.value, "→", newData?.usdkrw?.value);
  console.log("DOW:", od?.dow?.value, "→", newData?.dow?.value);
  console.log("WTI:", od?.wti?.value, "→", newData?.wti?.value);
  console.log("GOLD:", od?.gold?.value, "→", newData?.gold?.value);
  console.log("VIX:", od?.vix?.value, "→", newData?.vix?.value);
  console.log("US10Y:", od?.us10y?.value, "→", newData?.us10y?.value);
  console.log("BITCOIN:", od?.bitcoin?.value, "→", newData?.bitcoin?.value);
  console.log("DXY:", od?.dxy?.value, "→", newData?.dxy?.value);
  console.log("[diff] S&P:", od?.sp500?.value, "→", newData?.sp500?.value, "| IXIC:", od?.nasdaq?.value, "→", newData?.nasdaq?.value);
  console.log("[diff] DOW ch:", od?.dow?.change, "→", newData?.dow?.change, "| VIX ch:", od?.vix?.change, "→", newData?.vix?.change, "| US10Y ch:", od?.us10y?.change, "→", newData?.us10y?.change);
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
    rate: pairUs10y(ticker)
  };
  return out;
}

function formatUpdatedAtSuccess() {
  let s = kstUpdatedAt() + " KST · success";
  if (process.env.RUN_SLOT === "2차") {
    s += " · final update";
  }
  return s;
}

function runSlotLabel() {
  const raw = process.env.RUN_SLOT;
  if (raw === "1차") return "1차 실행";
  if (raw === "2차") return "2차 실행";
  if (raw === "수동") return "수동 실행";
  if (raw && String(raw).trim()) return String(raw).trim();
  return "로컬 실행";
}

function kstHour() {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hour12: false
    }).formatToParts(new Date());
    const hp = parts.find((p) => p.type === "hour");
    if (!hp) return NaN;
    return parseInt(hp.value, 10);
  } catch {
    return NaN;
  }
}

function isForceMarketSave() {
  const fu = String(process.env.FORCE_UPDATE || "").trim().toLowerCase();
  if (fu === "true" || fu === "1") {
    console.log("[fetch.js] isForceMarketSave: FORCE_UPDATE=", process.env.FORCE_UPDATE);
    return true;
  }
  if (process.env.RUN_SLOT === "2차") {
    console.log("[fetch.js] isForceMarketSave: RUN_SLOT=2차");
    return true;
  }
  const h = kstHour();
  if (Number.isFinite(h) && h >= 9) {
    console.log("[fetch.js] isForceMarketSave: KST hour>=9 →", h);
    return true;
  }
  return false;
}

function saveMarketJson(slot, market, reasonLabel) {
  market.updatedAt = new Date().toISOString();
  const json = JSON.stringify(market, null, 2) + "\n";
  fs.writeFileSync(usCloseSnapshotPath, json, "utf8");
  fs.writeFileSync(
    usCloseSnapshotJsPath,
    "window.US_CLOSE_SNAPSHOT_DATA = " + JSON.stringify(market) + ";\n",
    "utf8"
  );
  console.log("[fetch.js]", "[" + slot + "]", reasonLabel, usCloseSnapshotPath, "updatedAt(ISO)=", market.updatedAt);
}

async function main() {
  const slot = runSlotLabel();
  console.log("[fetch.js]", "[" + slot + "]", "시작", "FETCH_FORCE_SAVE=", FETCH_FORCE_SAVE);

  try {
    fs.mkdirSync(outDir, { recursive: true });
    console.log("[fetch.js]", "[" + slot + "]", "1단계: data 디렉터리 확인");

    const tickerData = await fetchTicker();
    try {
      fs.writeFileSync(tickerJsonPath, JSON.stringify(tickerData, null, 2) + "\n", "utf8");
      console.log(
        "[fetch.js]",
        "[" + slot + "]",
        "ticker.json 저장 완료",
        tickerJsonPath,
        "rows=",
        Array.isArray(tickerData) ? tickerData.length : 0
      );
    } catch (e) {
      console.error("FETCH ERROR (ticker.json write):", e);
      throw e;
    }

    let oldPanicOnDisk = null;
    try {
      if (fs.existsSync(outPath)) {
        oldPanicOnDisk = readJsonSafe(outPath);
      }
    } catch (e) {
      console.error("[fetch.js] FETCH ERROR (old panic read):", e);
    }

    console.log("[fetch.js]", "[" + slot + "]", "2단계: panic.json 소스 빌드");
    let payload;
    try {
      const built = buildFromSources();
      payload = built ?? { ...MOCK };
      payload.updatedAt = formatUpdatedAtSuccess();
    } catch (e) {
      console.error("FETCH ERROR:", e);
      throw e;
    }

    console.log("=== NEW DATA (panic.json payload) ===");
    console.log(JSON.stringify(payload, null, 2));
    console.log("=== OLD DATA (기존 panic.json) ===");
    console.log(JSON.stringify(oldPanicOnDisk || {}, null, 2));

    try {
      fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
      console.log("[fetch.js]", "[" + slot + "]", "panic.json 저장 완료", outPath, "updatedAt=", payload.updatedAt);
    } catch (e) {
      console.error("FETCH ERROR:", e);
      throw e;
    }

    console.log("[fetch.js]", "[" + slot + "]", "3단계: market 스냅샷 계산 (data/ticker.json 사용)");
    let market;
    try {
      const panic = readJsonSafe(panicPath);
      const ticker = loadTickerForMarket();
      const overseas = readJsonSafe(overseasPath);
      market = buildMarketSnapshot(panic, ticker, overseas);
    } catch (e) {
      console.error("FETCH ERROR:", e);
      throw e;
    }

    console.log("[fetch.js]", "[" + slot + "]", "4단계: 기존 us-close-snapshot.json 읽기");
    let oldMarket = null;
    try {
      if (fs.existsSync(usCloseSnapshotPath)) {
        oldMarket = readJsonSafe(usCloseSnapshotPath);
        console.log("[fetch.js]", "[" + slot + "]", "기존 파일:", oldMarket ? "파싱 성공" : "파싱 실패·무시");
      } else {
        console.log("[fetch.js]", "[" + slot + "]", "기존 us-close-snapshot.json 없음 → 최초 저장 허용");
      }
    } catch (e) {
      console.warn("[fetch.js]", "[" + slot + "]", "기존 market 읽기 경고:", e && e.message ? e.message : e);
      oldMarket = null;
    }

    const marketMerged = mergeMarketWithFallback(market, oldMarket);
    logMarketPayloads(marketMerged, oldMarket);
    logMarketFieldArrows(marketMerged, oldMarket);

    const forceMarket = isForceMarketSave();
    const valid = hasValidUpdate(marketMerged, oldMarket);
    console.log("[fetch.js]", "[" + slot + "]", "5단계: FETCH_FORCE_SAVE=", FETCH_FORCE_SAVE, "forceMarket=", forceMarket, "hasValidUpdate=", valid);

    if (FETCH_FORCE_SAVE) {
      console.log("🔥 FORCE UPDATE 실행 (FETCH_FORCE_SAVE)");
      try {
        saveMarketJson(slot, marketMerged, "us-close-snapshot.json 강제 저장(FETCH_FORCE_SAVE)");
      } catch (e) {
        console.error("FETCH ERROR:", e);
        throw e;
      }
    } else if (forceMarket) {
      console.log("🔥 FORCE UPDATE 실행 (2차/FORCE_UPDATE/KST≥9)");
      try {
        saveMarketJson(slot, marketMerged, "us-close-snapshot.json 강제 저장(슬롯/시간)");
      } catch (e) {
        console.error("FETCH ERROR:", e);
        throw e;
      }
    } else if (valid) {
      try {
        saveMarketJson(slot, marketMerged, "us-close-snapshot.json 저장(변화 감지)");
      } catch (e) {
        console.error("FETCH ERROR:", e);
        throw e;
      }
    } else {
      console.log(
        "[fetch.js]",
        "[" + slot + "]",
        "us-close-snapshot.json 스킵: 지수·VIX·US10Y value/change 전 구간이 이전과 동일 → 스테일 스냅샷으로 판단, 저장 안 함"
      );
    }
    console.log("[fetch.js]", "[" + slot + "]", "종료(정상)");
  } catch (e) {
    console.error("FETCH ERROR:", e && e.stack ? e.stack : e && e.message ? e.message : e);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("FETCH ERROR:", e && e.stack ? e.stack : e && e.message ? e.message : e);
  process.exitCode = 1;
});
