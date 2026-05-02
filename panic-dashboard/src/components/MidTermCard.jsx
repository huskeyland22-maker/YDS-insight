import TermPanel from "./TermPanel.jsx";

function formatMid(v, name) {
  if (name === "CNN Fear & Greed" || name === "GS B/B") return String(Math.round(v));
  if (name === "BofA Bull & Bear") return v.toFixed(2);
  return v.toFixed(2);
}

function midStatus(score) {
  if (score > 70) return "과열 — 비중 축소·익절";
  if (score >= 55) return "과열 기미 — 신규 물량 보수";
  if (score >= 45) return "중립 부근";
  return "냉각 구간 — 과열 압력 낮음";
}

/** @param {{ rows: { name: string; value: number; avg: number }[]; score: number }} props */
export default function MidTermCard({ rows, score }) {
  return (
    <TermPanel
      title="Mid-term"
      subtitle="중기 · 심리·자금·채권 변동성"
      score={score}
      statusText={midStatus(score)}
      rows={rows}
      accentBar="bg-gradient-to-r from-emerald-600 to-lime-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]"
      ringAccent="ring-emerald-500/20"
      scoreColor="text-emerald-400"
      formatValue={formatMid}
    />
  );
}
