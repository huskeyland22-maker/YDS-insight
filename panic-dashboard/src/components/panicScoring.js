/**
 * @typedef {{ name: string; value: number; avg: number }} PanicMetric
 */

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * 단기: 평균 대비 지표가 높을수록 공포(매수 기회) 점수 상승
 * @param {PanicMetric[]} rows
 */
export function computeShortScore(rows) {
  if (!rows?.length) return 0;
  const parts = rows.map(({ value, avg }) => {
    if (!avg) return 50;
    const ratio = value / avg;
    return clamp(50 + (ratio - 1) * 120, 0, 100);
  });
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/**
 * 중기: CNN·BofA·MOVE가 평균 대비 높을수록 과열(비중 축소) 쪽 점수 상승
 * @param {PanicMetric[]} rows
 */
export function computeMidScore(rows) {
  if (!rows?.length) return 0;
  const parts = rows.map(({ value, avg }) => {
    if (!avg) return 50;
    const ratio = value / avg;
    return clamp(50 + (ratio - 1) * 95, 0, 100);
  });
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/**
 * 장기: 평균 대비 높을수록 시스템 리스크 점수 상승
 * @param {PanicMetric[]} rows
 */
export function computeLongScore(rows) {
  if (!rows?.length) return 0;
  const parts = rows.map(({ value, avg }) => {
    if (!avg) return 50;
    const ratio = value / avg;
    return clamp(50 + (ratio - 1) * 110, 0, 100);
  });
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/**
 * 전체 패닉 점수: 단기 공포 + 장기 구조 리스크에 가중, 중기 과열은 상쇄
 */
export function computeOverallPanicScore(shortScore, midScore, longScore) {
  const raw =
    shortScore * 0.42 + longScore * 0.33 + (100 - midScore) * 0.25;
  return clamp(Math.round(raw), 0, 100);
}

/** @typedef {'fear' | 'neutral' | 'greed'} MarketTone */

/**
 * 시장 톤: 단기 공포 vs 중기 과열 우세로 판별
 * @returns {{ tone: MarketTone; label: string; emoji: string }}
 */
export function resolveMarketOverview(shortScore, midScore, longScore) {
  const fearLead = shortScore - midScore;
  const greedLead = midScore - shortScore;

  if (shortScore >= 58 && fearLead >= 8) {
    return { tone: "fear", label: "공포 (매수)", emoji: "🔴" };
  }
  if (midScore >= 58 && greedLead >= 8) {
    return { tone: "greed", label: "과열 (매도)", emoji: "🟢" };
  }
  if (longScore >= 72 && shortScore < 55) {
    return { tone: "neutral", label: "구조 리스크 주의", emoji: "🟡" };
  }
  return { tone: "neutral", label: "중립", emoji: "🟡" };
}

/**
 * @typedef {{
 *   shortBuy: boolean;
 *   midTrim: boolean;
 *   longRisk: boolean;
 *   soxl: { enter: boolean; note: string };
 *   tqqq: { enter: boolean; note: string };
 *   riskOff: boolean;
 *   dcaBuy: string;
 *   dcaSell: string;
 *   bullets: string[];
 * }} StrategyPack
 */

/**
 * @param {number} shortScore
 * @param {number} midScore
 * @param {number} longScore
 * @returns {StrategyPack}
 */
export function buildStrategy(shortScore, midScore, longScore) {
  const shortBuy = shortScore > 70;
  const midTrim = midScore > 70;
  const longRisk = longScore > 70;

  const riskOff = longRisk || (midTrim && shortScore < 55);

  const soxlEnter = shortBuy && !riskOff;
  const tqqqEnter = shortBuy && !riskOff && midScore < 68;

  const soxl = {
    enter: soxlEnter,
    note: soxlEnter
      ? "단기 공포 구간 — 레버 진입 후보"
      : shortBuy
        ? "신호는 강하나 장·중기 리스크로 보수적 대기"
        : "단기 공포 신호 미달 — 관망 또는 소액 분할",
  };

  const tqqq = {
    enter: tqqqEnter,
    note: tqqqEnter
      ? "나스닥 레버 — 단기 매수 시그널 + 중기 과열 완화"
      : midScore >= 68
        ? "중기 과열 구간 — TQQQ 신규 비중 확대 자제"
        : "조건 미충족 — SOXL 대비 보수 운용",
  };

  const dcaBuy = shortBuy
    ? "3~4회 분할: 첫 25% 즉시, 이후 -2~-3% 간격"
    : "신호 대기 — 확정 시 2~3회 소액 분할만";

  const dcaSell = midTrim
    ? "익절: 보유분 30~50% 차감, 나머지 트레일"
    : "추가 매도 없음 — 포지션 유지 또는 리밸런싱만";

  const bullets = [];
  if (shortBuy) bullets.push("단기: SOXL / TQQQ 단기 매수 존");
  if (midTrim) bullets.push("중기: 비중 축소 / 익절");
  if (longRisk) bullets.push("장기: 시장 리스크 경고");
  if (!bullets.length) bullets.push("강한 엣지 없음 — 중립 운용");

  return {
    shortBuy,
    midTrim,
    longRisk,
    soxl,
    tqqq,
    riskOff,
    dcaBuy,
    dcaSell,
    bullets,
  };
}
