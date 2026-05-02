import { useMemo, useCallback } from "react";
import ShortTermCard from "./ShortTermCard.jsx";
import MidTermCard from "./MidTermCard.jsx";
import LongTermCard from "./LongTermCard.jsx";
import GaugeBar from "./GaugeBar.jsx";
import {
  computeShortScore,
  computeMidScore,
  computeLongScore,
  computeOverallPanicScore,
  resolveMarketOverview,
  buildStrategy,
} from "./panicScoring.js";

function toneStyles(tone) {
  if (tone === "fear")
    return {
      badge: "bg-red-500/15 text-red-300 ring-red-500/30",
      gauge: "bg-gradient-to-r from-red-600 to-rose-400",
    };
  if (tone === "greed")
    return {
      badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
      gauge: "bg-gradient-to-r from-emerald-600 to-lime-400",
    };
  return {
    badge: "bg-amber-500/10 text-amber-200 ring-amber-500/25",
    gauge: "bg-gradient-to-r from-amber-500 to-yellow-400",
  };
}

/** @param {{ data: { short: any[]; mid: any[]; long: any[] } }} props */
export default function PanicDashboard({ data }) {
  const model = useMemo(() => {
    const shortScore = computeShortScore(data.short);
    const midScore = computeMidScore(data.mid);
    const longScore = computeLongScore(data.long);
    const overall = computeOverallPanicScore(shortScore, midScore, longScore);
    const overview = resolveMarketOverview(shortScore, midScore, longScore);
    const strategy = buildStrategy(shortScore, midScore, longScore);
    return { shortScore, midScore, longScore, overall, overview, strategy };
  }, [data]);

  const { shortScore, midScore, longScore, overall, overview, strategy } = model;
  const styles = toneStyles(overview.tone);

  const onAction = useCallback((label) => {
    // 브로커 연동 전까지 — 사용자 확인용 로그
    console.info(`[PanicDashboard] 액션: ${label}`);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-8 flex flex-col gap-2 border-b border-white/5 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-red-400/80">
            Leverage timing
          </p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            패닉 시그널 · SOXL / TQQQ
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            단·중·장기 점수로 진입·익절·리스크 회피를 한 화면에서 결정합니다.
          </p>
        </div>
        <div className="font-mono text-xs text-terminal-muted">
          {new Date().toLocaleString("ko-KR", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      </header>

      {/* 1) Market Overview */}
      <section className="mb-8 rounded-2xl border border-terminal-border bg-gradient-to-br from-terminal-card to-black/40 p-5 sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Market overview
            </h2>
            <div className="mt-3 flex flex-wrap items-baseline gap-4">
              <span className="font-mono text-5xl font-bold tabular-nums text-white sm:text-6xl">
                {overall}
              </span>
              <span className="text-sm text-slate-500">/ 100</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">종합 패닉·리스크 스코어</p>
          </div>
          <div className="flex flex-1 flex-col gap-3 lg:max-w-md">
            <div
              className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 font-medium ring-1 ${styles.badge}`}
            >
              <span className="text-lg" aria-hidden>
                {overview.emoji}
              </span>
              <span>현재 시장 상태 · {overview.label}</span>
            </div>
            <GaugeBar value={overall} accentClass={styles.gauge} />
          </div>
        </div>
      </section>

      {/* 2) Three panels */}
      <section className="mb-8 grid gap-4 lg:grid-cols-3">
        <ShortTermCard rows={data.short} score={shortScore} />
        <MidTermCard rows={data.mid} score={midScore} />
        <LongTermCard rows={data.long} score={longScore} />
      </section>

      {/* 3) Trading signals */}
      <section className="mb-6 rounded-2xl border border-terminal-border bg-terminal-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Trading signals
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-lg font-semibold text-sky-300">SOXL</span>
              <span
                className={`rounded px-2 py-0.5 font-mono text-xs font-bold uppercase ${
                  strategy.soxl.enter
                    ? "bg-red-500/20 text-red-300"
                    : "bg-slate-700 text-slate-400"
                }`}
              >
                {strategy.soxl.enter ? "진입" : "관망"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{strategy.soxl.note}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-lg font-semibold text-violet-300">TQQQ</span>
              <span
                className={`rounded px-2 py-0.5 font-mono text-xs font-bold uppercase ${
                  strategy.tqqq.enter
                    ? "bg-red-500/20 text-red-300"
                    : "bg-slate-700 text-slate-400"
                }`}
              >
                {strategy.tqqq.enter ? "진입" : "관망"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{strategy.tqqq.note}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/5 bg-black/20 p-4 md:col-span-1">
            <p className="text-xs font-semibold uppercase text-slate-500">리스크 회피</p>
            <p
              className={`mt-1 font-mono text-lg font-bold ${
                strategy.riskOff ? "text-amber-400" : "text-slate-500"
              }`}
            >
              {strategy.riskOff ? "권장" : "비권장"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              장기 경고 또는 중기 과열 + 단기 미약 시 방어
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/20 p-4 md:col-span-2">
            <p className="text-xs font-semibold uppercase text-slate-500">분할 전략</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              <li>
                <span className="text-red-400/90">매수</span> · {strategy.dcaBuy}
              </li>
              <li>
                <span className="text-emerald-400/90">매도</span> · {strategy.dcaSell}
              </li>
            </ul>
          </div>
        </div>

        <ul className="mt-4 flex flex-wrap gap-2">
          {strategy.bullets.map((b) => (
            <li
              key={b}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs text-slate-300"
            >
              {b}
            </li>
          ))}
        </ul>
      </section>

      {/* 4) Actions */}
      <section className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Actions</h2>
        <p className="mt-1 text-xs text-slate-500">
          실제 주문은 브로커에서 실행하세요. 버튼은 체크리스트용입니다.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => onAction("SOXL 매수")}
            className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-6 py-3 font-semibold text-white shadow-lg shadow-red-900/30 transition hover:brightness-110 active:scale-[0.99]"
          >
            SOXL 매수
          </button>
          <button
            type="button"
            onClick={() => onAction("TQQQ 매수")}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 active:scale-[0.99]"
          >
            TQQQ 매수
          </button>
          <button
            type="button"
            onClick={() => onAction("리스크 회피")}
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-6 py-3 font-semibold text-amber-200 transition hover:bg-amber-500/20 active:scale-[0.99]"
          >
            리스크 회피
          </button>
        </div>
      </section>
    </div>
  );
}
