import TermPanel from "./TermPanel.jsx";

function formatLong(v, name) {
  if (name === "GS B/B") return String(Math.round(v));
  if (name === "HY Spread") return v.toFixed(2);
  return v.toFixed(2);
}

function longStatus(score) {
  if (score > 70) return "구조 리스크 경고";
  if (score >= 55) return "리스크 상승 — 방어적";
  if (score >= 45) return "중립 부근";
  return "구조적 압력 완화";
}

/** @param {{ rows: { name: string; value: number; avg: number }[]; score: number }} props */
export default function LongTermCard({ rows, score }) {
  return (
    <TermPanel
      title="Long-term"
      subtitle="장기 · 꼬리·크레딧·포지셔닝"
      score={score}
      statusText={longStatus(score)}
      rows={rows}
      accentBar="bg-gradient-to-r from-amber-600 to-orange-500 shadow-[0_0_12px_rgba(251,146,60,0.3)]"
      ringAccent="ring-amber-500/15"
      scoreColor="text-amber-400"
      formatValue={formatLong}
    />
  );
}
