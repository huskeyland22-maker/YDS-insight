export const MARKET_RULES = [
  {
    name: "risk_on",
    condition: function (d) {
      return d.vix < 20 && d.us10y <= 0 && d.hy < 4;
    },
    score: 2,
    action: {
      mode: "공격",
      etf: ["SOXL", "TQQQ"],
      comment: "성장주 / 반도체 중심",
      split: [25, 35, 40],
    },
  },
  {
    name: "risk_off",
    condition: function (d) {
      return d.vix > 25 || d.hy > 4.5;
    },
    score: -2,
    action: {
      mode: "방어",
      comment: "현금 비중 확대",
      strategy: "현금 비중 확대",
    },
  },
  {
    name: "neutral",
    condition: function () {
      return true;
    },
    score: 0,
    action: {
      mode: "중립",
      comment: "관망",
      strategy: "관망 / 일부만 진입",
    },
  },
];
