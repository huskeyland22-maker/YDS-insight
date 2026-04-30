export function getScenario(state) {
  switch (state) {
    case "risk_on":
      return {
        title: "Risk On",
        strategy: "반도체 / AI 중심 공격",
      };
    case "risk_off":
      return {
        title: "Risk Off",
        strategy: "현금 / 방어",
      };
    default:
      return {
        title: "Neutral",
        strategy: "선별적 대응",
      };
  }
}
