import TermPanel from "./TermPanel.jsx";

function formatShort(v, name) {
  if (name === "Put/Call") return v.toFixed(2);
  return v.toFixed(2);
}

function shortStatus(score) {
  if (score > 70) return "강한 공포 — 레버 단기 매수 존";
  if (score >= 55) return "공포 우세 — 분할 매수 검토";
  if (score >= 45) return "중립 부근 — 신중 대응";
  return "낮은 공포 — 추격 매수 자제";
}

/** @param {{ rows: { name: string; value: number; avg: number }[]; score: number }} props */
export default function ShortTermCard({ rows, score }) {
  return (
    <TermPanel
      title="Short-term"
      subtitle="단기 · VIX / VXN / Put-Call"
      score={score}
      statusText={shortStatus(score)}
      rows={rows}
      accentBar="bg-gradient-to-r from-red-600 to-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.35)]"
      ringAccent="ring-red-500/20"
      scoreColor="text-red-400"
      formatValue={formatShort}
    />
  );
}
