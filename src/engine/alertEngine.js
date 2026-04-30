const ALERT_KEY = "last_state";
const BUY_LEVEL_KEY = "last_buy_signal_level";

export function checkAlert(newState) {
  if (!newState) return;
  const prev = localStorage.getItem(ALERT_KEY);
  if (prev !== newState) {
    if (prev) {
      alert("시장 상태 변경: " + prev + " -> " + newState);
    }
    localStorage.setItem(ALERT_KEY, newState);
  }
}

export function checkBuySignal(panicScore) {
  const score = Number(panicScore);
  if (!Number.isFinite(score)) return;

  let level = "none";
  if (score >= 80) level = "strong";
  else if (score >= 70) level = "buy";

  const prevLevel = localStorage.getItem(BUY_LEVEL_KEY) || "none";
  if (level !== prevLevel) {
    if (level === "strong") alert("강력 매수 타이밍!");
    else if (level === "buy") alert("매수 구간 진입!");
    localStorage.setItem(BUY_LEVEL_KEY, level);
  }
}
