export function renderDecision(result) {
  var el = document.getElementById("decision-output");
  if (!el) return;

  var scenario = result && result.scenario ? "<p>시나리오: " + result.scenario + "</p>" : "";
  var etf = result && result.action && result.action.etf
    ? "<p>ETF: " + result.action.etf.join(", ") + "</p>"
    : "";
  var split = result && result.action && result.action.split
    ? "<p>분할매수: " + result.action.split.join(" / ") + "</p>"
    : "";
  var strategy = result && result.action && result.action.strategy
    ? "<p>전략: " + result.action.strategy + "</p>"
    : "";

  el.innerHTML =
    "<h3>현재 상태: " + (result && result.state ? result.state : "-") + "</h3>" +
    "<p>모드: " + (result && result.action && result.action.mode ? result.action.mode : "-") + "</p>" +
    etf +
    split +
    strategy +
    scenario;
}
