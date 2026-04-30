import { getWinRate } from "../engine/analyticsEngine.js";

export function renderAnalytics(trades) {
  const el = document.getElementById("analytics");
  if (!el) return;

  const list = trades || [];
  const winRate = getWinRate(list);
  el.innerHTML =
    "<h3>승률: " +
    winRate +
    "%</h3>" +
    "<p>총 트레이드: " +
    list.length +
    "</p>";
}
