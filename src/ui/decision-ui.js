export function renderDecision(result) {
  var el = document.getElementById("decision-output");
  if (!el) return;

  var etf = result && result.action && result.action.etf
    ? "<p>ETF: " + result.action.etf.join(", ") + "</p>"
    : "";

  el.innerHTML =
    "<h3>시장 상태: " + String((result && result.state) || "neutral").toUpperCase() + "</h3>" +
    "<p>모드: " + ((result && result.action && result.action.mode) || "-") + "</p>" +
    "<p>" + ((result && result.action && result.action.comment) || "") + "</p>" +
    etf;
}

export function renderScenario(scenario) {
  var el = document.getElementById("scenario-output");
  if (!el) return;

  el.innerHTML =
    "<h3>" + ((scenario && scenario.title) || "Neutral") + "</h3>" +
    "<p>" + ((scenario && scenario.strategy) || "선별적 대응") + "</p>";
}
