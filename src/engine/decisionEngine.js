import { MARKET_RULES } from "../rules/marketRules.js";

export function evaluateMarket(data) {
  for (var i = 0; i < MARKET_RULES.length; i += 1) {
    var rule = MARKET_RULES[i];
    if (rule.condition(data)) {
      return {
        state: rule.name,
        score: rule.score,
        action: rule.action,
      };
    }
  }
  return {
    state: "neutral",
    score: 0,
    action: { mode: "중립", strategy: "관망 / 일부만 진입" },
  };
}
