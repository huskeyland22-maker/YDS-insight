export function getWinRate(trades) {
  const list = trades || [];
  const wins = list.filter((t) => Number(t.return) > 0).length;
  const total = list.length;
  if (total === 0) return "0.0";
  return ((wins / total) * 100).toFixed(1);
}
