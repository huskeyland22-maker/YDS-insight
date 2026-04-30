import { getTrades, replaceTrades } from "./tradeEngine.js";
import { calculateReturn } from "./performanceEngine.js";
import { getStockPrice } from "./priceEngine.js";
import { getKoreaPrice } from "./koreaPriceEngine.js";

const PRICE_CACHE_TTL_MS = 90 * 1000;
const priceCache = new Map();

function isKoreaStockCode(code) {
  return /^[0-9]{6}$/.test(String(code || ""));
}

function getCachedPrice(code) {
  const cached = priceCache.get(code);
  if (!cached) return null;
  if (Date.now() - cached.ts > PRICE_CACHE_TTL_MS) return null;
  return cached.price;
}

function setCachedPrice(code, price) {
  priceCache.set(code, { price, ts: Date.now() });
}

export async function updateLiveTrades() {
  const trades = getTrades();

  const updated = await Promise.all(
    trades.map(async (t) => {
      if (!t || !t.code || t.code === "CASH") return t;

      let current = null;
      try {
        const cached = getCachedPrice(t.code);
        if (Number.isFinite(cached)) {
          current = cached;
        } else {
          current = isKoreaStockCode(t.code)
            ? await getKoreaPrice(t.code)
            : await getStockPrice(t.code);
          if (Number.isFinite(Number(current))) {
            setCachedPrice(t.code, Number(current));
          }
        }
      } catch (e) {
        current = null;
      }

      const fallbackCurrent = Number(t.current) || Number(t.entry) || 0;
      const resolvedCurrent = Number.isFinite(Number(current))
        ? Number(current)
        : fallbackCurrent;

      return {
        ...t,
        current: resolvedCurrent,
        return: calculateReturn(t.entry, resolvedCurrent),
        priceStatus: Number.isFinite(Number(current)) ? "live" : "stale",
        updatedAt: new Date().toISOString(),
      };
    })
  );

  replaceTrades(updated);
  return updated;
}
