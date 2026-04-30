export function getExecutionPlan(state) {
  if (state === "risk_on") {
    return {
      strategy: "공격적 분할매수",
      rule: "25% -> 35% -> 40%",
      comment: "눌림 구간에서 진입",
    };
  }

  if (state === "risk_off") {
    return {
      strategy: "방어",
      rule: "신규 진입 금지",
      comment: "현금 비중 유지",
    };
  }

  return {
    strategy: "중립",
    rule: "소액 테스트 진입",
    comment: "방향 확인 후 확대",
  };
}
