import { getTrades, replaceTrades } from "./tradeEngine.js";
import { calculateReturn } from "./performanceEngine.js";
import { getStockPrice } from "./priceEngine.js";
import { getKoreaPrice } from "./koreaPriceEngine.js";

function isKoreaStockCode(code) {
  return /^[0-9]{6}$/.test(String(code || ""));
}

export async function updateLiveTrades() {
  const trades = getTrades();

  const updated = await Promise.all(
    trades.map(async (t) => {
      if (!t || !t.code || t.code === "CASH") return t;

      let current = null;
      try {
        current = isKoreaStockCode(t.code)
          ? await getKoreaPrice(t.code)
          : await getStockPrice(t.code);
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
      };
    })
  );

  replaceTrades(updated);
  return updated;
}
