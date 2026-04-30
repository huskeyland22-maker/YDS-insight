export function renderTradeHistory(trades) {
  const el = document.getElementById("trade-history");
  if (!el) return;

  const list = trades || [];
  if (list.length === 0) {
    el.innerHTML = "<p>아직 기록된 매매가 없습니다.</p>";
    return;
  }

  el.innerHTML = list
    .map(
      (t) =>
        '<div class="overseas-card">' +
        "<strong>" +
        t.name +
        "</strong>" +
        "<p>진입가: " +
        t.entry +
        "</p>" +
        "<p>현재가: " +
        t.current +
        "</p>" +
        "<p>가격 상태: " +
        (t.priceStatus === "live" ? "실시간" : "이전값 유지") +
        "</p>" +
        "<p>수익률: " +
        t.return +
        "%</p>" +
        "</div>"
    )
    .join("");
}
