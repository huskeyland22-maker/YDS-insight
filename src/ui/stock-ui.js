export function renderStocks(stocks, plan, onBuy) {
  var el = document.getElementById("stock-recommendation");
  if (!el) return;

  var listHtml = (stocks || [])
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

  el.innerHTML =
    "<h3>추천 종목</h3>" +
    "<ul>" +
    listHtml +
    "</ul>" +
    "<h3>진입 전략</h3>" +
    "<p>" +
    (plan && plan.strategy ? plan.strategy : "-") +
    "</p>" +
    "<p>" +
    (plan && plan.rule ? plan.rule : "-") +
    "</p>" +
    "<p>" +
    (plan && plan.comment ? plan.comment : "-") +
    "</p>";

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
}
