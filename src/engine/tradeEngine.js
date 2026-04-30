const STORAGE_KEY = "trade_history_v1";

export function saveTrade(trade) {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  history.unshift({
    ...trade,
    date: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function getTrades() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

export function replaceTrades(trades) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades || []));
}
