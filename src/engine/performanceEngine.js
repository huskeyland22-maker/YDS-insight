export function calculateReturn(entry, current) {
  const e = Number(entry);
  const c = Number(current);
  if (!Number.isFinite(e) || e <= 0 || !Number.isFinite(c)) return "0.00";
  return (((c - e) / e) * 100).toFixed(2);
}
