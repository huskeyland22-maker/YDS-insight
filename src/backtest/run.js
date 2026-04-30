import { marketData } from "./data.js";
import { runBacktest } from "./backtestEngine.js";
import { analyze } from "./analytics.js";

const result = runBacktest(marketData);
const stats = analyze(result.trades, result.finalValue);

console.log("최종 자산:", Math.round(result.finalValue));
console.log("승률:", stats.winRate + "%");
console.log("거래 수:", stats.totalTrades);
console.log("트레이드:", result.trades);
