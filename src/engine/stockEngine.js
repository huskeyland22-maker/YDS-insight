export const STOCK_POOL = {
  risk_on: [
    { name: "삼성전자", code: "005930", sector: "반도체" },
    { name: "SK하이닉스", code: "000660", sector: "반도체" },
    { name: "한미반도체", code: "042700", sector: "AI/장비" },
  ],
  neutral: [{ name: "삼성전자", code: "005930", sector: "코어" }],
  risk_off: [{ name: "현금", code: "CASH", sector: "방어" }],
};

export function getRecommendedStocks(state) {
  return STOCK_POOL[state] || [];
}
