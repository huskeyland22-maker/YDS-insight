export function analyze(trades, finalValue) {
  const sells = (trades || []).filter((t) => t.type === "SELL");
  const wins = sells.filter((t) => Number(t.return) > 0).length;
  const total = sells.length;
  const winRate = total ? ((wins / total) * 100).toFixed(1) : "0.0";

  return {
    winRate,
    totalTrades: total,
    finalValue,
  };
}
