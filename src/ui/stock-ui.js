export function renderStocks(stocks, plan, onBuy, onManualBuy) {
  var el = document.getElementById("stock-recommendation");
  if (!el) return;

  var safeStocks = stocks || [];
  var listHtml = safeStocks
    .map(function (s) {
      var buyBtn =
        s.code !== "CASH"
          ? ' <button type="button" data-buy-code="' +
            s.code +
            '" class="overseas-quick-btn overseas-quick-btn--save">매수 기록</button>'
          : "";
      return "<li>" + s.name + " (" + s.sector + ")" + buyBtn + "</li>";
    })
    .join("");
  var listBlock = listHtml
    ? "<ul>" + listHtml + "</ul>"
    : "<p>현재 추천 종목이 없습니다.</p>";

  el.innerHTML =
    "<h3>추천 종목</h3>" +
    listBlock +
    "<h3>진입 전략</h3>" +
    "<p>" +
    (plan && plan.strategy ? plan.strategy : "-") +
    "</p>" +
    "<p>" +
    (plan && plan.rule ? plan.rule : "-") +
    "</p>" +
    "<p>" +
    (plan && plan.comment ? plan.comment : "-") +
    "</p>" +
    '<hr style="border-color:#2a3550;opacity:0.5;margin:14px 0;">' +
    "<h3>수동 매수 기록</h3>" +
    '<p style="margin-top:0;color:#9fb0d3;">추천 버튼이 안 보여도 여기서 직접 기록할 수 있습니다.</p>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;align-items:center;">' +
    '<input id="manual-buy-name" placeholder="종목명 (예: 삼성전자)" />' +
    '<input id="manual-buy-code" placeholder="코드 (예: 005930)" />' +
    '<input id="manual-buy-entry" type="number" min="1" step="1" placeholder="진입가" />' +
    '<button type="button" id="manual-buy-save" class="overseas-quick-btn overseas-quick-btn--save">기록</button>' +
    "</div>";

  if (typeof onBuy === "function") {
    var buttons = el.querySelectorAll("[data-buy-code]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var code = btn.getAttribute("data-buy-code");
        var stock = (stocks || []).find(function (s) {
          return String(s.code) === String(code);
        });
        if (stock) onBuy(stock);
      });
    });
  }

  if (typeof onManualBuy === "function") {
    var manualSave = el.querySelector("#manual-buy-save");
    if (manualSave) {
      manualSave.addEventListener("click", function () {
        var nameEl = el.querySelector("#manual-buy-name");
        var codeEl = el.querySelector("#manual-buy-code");
        var entryEl = el.querySelector("#manual-buy-entry");
        var name = nameEl ? String(nameEl.value || "").trim() : "";
        var code = codeEl ? String(codeEl.value || "").trim() : "";
        var entry = entryEl ? Number(entryEl.value) : NaN;
        onManualBuy({ name: name, code: code, entry: entry });
      });
    }
  }
}
