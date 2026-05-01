/**
 * scripts/fetch.js — data/panic.json 갱신 (overwrite)
 * panic-data.json의 previousClose·change 기반으로 { now, prev } 구조 생성
 * data/market.json — 스테일 판별 후 유효할 때만 덮어쓰기
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
    us10y: { value: parseNum(us10?.value), change: pctOrPointsFromDelta(us10?.delta) }
  };
}

/** market.json 항목 value 안전 추출 */
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

/**
 * DOW·S&P·NASDAQ·NASDAQ100·VIX·US10Y의 value·change가 이전 파일과 전부 동일하면
 * Yahoo 캐시 등으로 스테일한 스냅샷으로 보고 저장 생략.
 * (구버전은 NASDAQ 100을 비교에서 빼서 NDX만 바뀌어도 market.json이 안 갱신되는 버그가 있었음.)
 */
function hasValidUpdate(newData, oldData) {
  if (!oldData) return true;

  const nd = newData && typeof newData === "object" ? newData : {};
  const od = oldData && typeof oldData === "object" ? oldData : {};

  const keys = ["dow", "sp500", "nasdaq", "nasdaq100", "vix", "us10y"];
  for (const k of keys) {
    if (mv(nd, k) !== mv(od, k)) return true;
    if (mc(nd, k) !== mc(od, k)) return true;
  }

  return false;
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

/** panic / market 공통: 성공 시각 + 성공 표기, 2차 스케줄에서만 final update */
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

/** 2차 슬롯·FORCE_UPDATE·KST 09시 이후 → market.json 스테일 스킵 무시하고 저장 */
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

function main() {
  const slot = runSlotLabel();
  console.log("[fetch.js]", "[" + slot + "]", "시작");

  try {
    fs.mkdirSync(outDir, { recursive: true });
    console.log("[fetch.js]", "[" + slot + "]", "1단계: data 디렉터리 확인");

    console.log("[fetch.js]", "[" + slot + "]", "2단계: panic.json 소스 빌드");
    let payload;
    try {
      const built = buildFromSources();
      payload = built ?? { ...MOCK };
      payload.updatedAt = formatUpdatedAtSuccess();
    } catch (e) {
      console.error("[fetch.js]", "[" + slot + "]", "panic 페이로드 빌드 실패:", e && e.message ? e.message : e);
      throw e;
    }
    try {
      fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
      console.log("[fetch.js]", "[" + slot + "]", "panic.json 저장 완료", outPath, "updatedAt=", payload.updatedAt);
    } catch (e) {
      console.error("[fetch.js]", "[" + slot + "]", "panic.json 쓰기 실패:", e && e.message ? e.message : e);
      throw e;
    }

    console.log("[fetch.js]", "[" + slot + "]", "3단계: market 스냅샷 계산");
    let market;
    try {
      const panic = readJsonSafe(panicPath);
      const ticker = readJsonSafe(tickerPath);
      market = buildMarketSnapshot(panic, ticker);
    } catch (e) {
      console.error("[fetch.js]", "[" + slot + "]", "market 스냅샷 계산 실패:", e && e.message ? e.message : e);
      throw e;
    }

    console.log("[fetch.js]", "[" + slot + "]", "4단계: 기존 market.json 읽기");
    let oldMarket = null;
    try {
      if (fs.existsSync(marketPath)) {
        oldMarket = readJsonSafe(marketPath);
        console.log("[fetch.js]", "[" + slot + "]", "기존 파일:", oldMarket ? "파싱 성공" : "파싱 실패·무시");
      } else {
        console.log("[fetch.js]", "[" + slot + "]", "기존 market.json 없음 → 최초 저장 허용");
      }
    } catch (e) {
      console.warn("[fetch.js]", "[" + slot + "]", "기존 market 읽기 경고:", e && e.message ? e.message : e);
      oldMarket = null;
    }

    const forceMarket = isForceMarketSave();
    console.log("[fetch.js]", "[" + slot + "]", "5단계: forceMarket=", forceMarket);
    const valid = hasValidUpdate(market, oldMarket);
    console.log("[fetch.js]", "[" + slot + "]", "hasValidUpdate=", valid);

    if (forceMarket) {
      try {
        market.updatedAt = formatUpdatedAtSuccess();
        fs.writeFileSync(marketPath, JSON.stringify(market, null, 2) + "\n", "utf8");
        console.log("[fetch.js]", "[" + slot + "]", "market.json 강제 저장 완료", marketPath, "updatedAt=", market.updatedAt);
      } catch (e) {
        console.error("[fetch.js]", "[" + slot + "]", "market.json 강제 저장 실패:", e && e.message ? e.message : e);
        throw e;
      }
    } else if (valid) {
      try {
        market.updatedAt = formatUpdatedAtSuccess();
        fs.writeFileSync(marketPath, JSON.stringify(market, null, 2) + "\n", "utf8");
        console.log("[fetch.js]", "[" + slot + "]", "market.json 저장 완료", marketPath, "updatedAt=", market.updatedAt);
      } catch (e) {
        console.error("[fetch.js]", "[" + slot + "]", "market.json 저장 실패:", e && e.message ? e.message : e);
        throw e;
      }
    } else {
      console.log(
        "[fetch.js]",
        "[" + slot + "]",
        "market.json 스킵: 지수·VIX·US10Y value/change 전 구간이 이전과 동일 → 스테일 스냅샷으로 판단, 저장 안 함"
      );
    }
    console.log("[fetch.js]", "[" + slot + "]", "종료(정상)");
  } catch (e) {
    console.error("[fetch.js]", "[" + slot + "]", "실패:", e && e.stack ? e.stack : e && e.message ? e.message : e);
    process.exitCode = 1;
  }
}

main();
