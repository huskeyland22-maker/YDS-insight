import { getMarketData, getMarketDataFromGlobals } from "./data/marketData.js";
import { evaluateMarket } from "./engine/decisionEngine.js";
import { getScenario } from "./engine/scenarioEngine.js";
import { getRecommendedStocks } from "./engine/stockEngine.js";
import { getExecutionPlan } from "./engine/executionEngine.js";
import { saveTrade } from "./engine/tradeEngine.js";
import { updateLiveTrades } from "./engine/liveUpdateEngine.js";
import { checkAlert, checkBuySignal } from "./engine/alertEngine.js";
import { renderDecision, renderScenario } from "./ui/decision-ui.js";
import { renderStocks } from "./ui/stock-ui.js";
import { renderTradeHistory } from "./ui/trade-ui.js";
import { renderAnalytics } from "./ui/analytics-ui.js";

async function refreshTradePanels() {
  var trades = await updateLiveTrades();
  renderTradeHistory(trades);
  renderAnalytics(trades);
}

async function handleBuy(stock) {
  var entryPrice = window.prompt(stock.name + " 진입가 입력");
  var entry = Number(entryPrice);
  if (!Number.isFinite(entry) || entry <= 0) return;

  saveTrade({
    name: stock.name,
    code: stock.code,
    entry: entry,
    current: entry,
    return: 0,
  });

  await refreshTradePanels();
}

async function handleManualBuy(input) {
  var name = input && input.name ? String(input.name).trim() : "";
  var code = input && input.code ? String(input.code).trim() : "";
  var entry = Number(input && input.entry);

  if (!name || !code || !Number.isFinite(entry) || entry <= 0) {
    alert("종목명/코드/진입가를 올바르게 입력해 주세요.");
    return;
  }

  saveTrade({
    name: name,
    code: code,
    entry: entry,
    current: entry,
    return: 0,
  });

  await refreshTradePanels();
}

function getPanicScore(result) {
  var scoreFromFlow =
    window.OVERSEAS_DATA &&
    window.OVERSEAS_DATA.flow &&
    window.OVERSEAS_DATA.flow.regime &&
    Number(window.OVERSEAS_DATA.flow.regime.score);
  if (Number.isFinite(scoreFromFlow)) return scoreFromFlow;

  var scoreFromRule = Number(result && result.score);
  if (Number.isFinite(scoreFromRule)) {
    if (scoreFromRule === 2) return 80;
    if (scoreFromRule === 0) return 55;
    if (scoreFromRule === -2) return 30;
  }
  return null;
}

async function runDecisionEngine() {
  var data = null;

  if (window.TICKER_DATA && window.PANIC_DATA) {
    data = getMarketDataFromGlobals(window.TICKER_DATA, window.PANIC_DATA);
  } else {
    data = getMarketData({
      vix: 18,
      us10y: -0.02,
      hy: 3.8,
      ndx: 1.2,
      sentiment: 60,
    });
  }

  var result = evaluateMarket(data);
  var scenario = getScenario(result.state);
  var stocks = getRecommendedStocks(result.state);
  var plan = getExecutionPlan(result.state);
  var panicScore = getPanicScore(result);

  checkAlert(result.state);
  checkBuySignal(panicScore);

  renderDecision(result);
  renderScenario(scenario);
  renderStocks(stocks, plan, handleBuy, handleManualBuy);
  await refreshTradePanels();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runDecisionEngine);
} else {
  runDecisionEngine();
}

setInterval(refreshTradePanels, 60000);
