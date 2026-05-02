import GaugeBar from "./GaugeBar.jsx";

/**
 * @param {{
 *   title: string;
 *   subtitle: string;
 *   score: number;
 *   statusText: string;
 *   rows: { name: string; value: number; avg: number }[];
 *   accentBar: string;
 *   ringAccent: string;
 *   scoreColor: string;
 *   formatValue?: (v: number, name: string) => string;
 * }} props
 */
export default function TermPanel({
  title,
  subtitle,
  score,
  statusText,
  rows,
  accentBar,
  ringAccent,
  scoreColor,
  formatValue = (v) => v.toFixed(2),
}) {
  return (
    <article
      className={`flex flex-col rounded-xl border border-terminal-border bg-terminal-card p-4 shadow-lg ring-1 ${ringAccent} sm:p-5`}
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-white/5 pb-3">
        <div>
          <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-slate-400">
            {title}
          </h3>
          <p className="text-xs text-terminal-muted">{subtitle}</p>
        </div>
        <div className="text-right">
          <div
            className={`font-mono text-3xl font-bold tabular-nums tracking-tight sm:text-4xl ${scoreColor}`}
          >
            {score}
          </div>
          <p className="max-w-[12rem] text-right text-xs text-slate-400">
            {statusText}
          </p>
        </div>
      </header>

      <GaugeBar value={score} accentClass={accentBar} />

      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const vs = row.avg ? row.value / row.avg - 1 : 0;
          const bias =
            Math.abs(vs) < 0.03 ? "text-slate-500" : vs > 0 ? "text-amber-400/90" : "text-sky-400/90";
          return (
            <li
              key={row.name}
              className="flex items-center justify-between gap-2 rounded-lg bg-black/25 px-3 py-2 font-mono text-sm"
            >
              <span className="text-slate-400">{row.name}</span>
              <span className="tabular-nums text-slate-100">
                <span className="font-semibold text-white">
                  {formatValue(row.value, row.name)}
                </span>
                <span className="mx-1.5 text-terminal-muted">/</span>
                <span className="text-terminal-muted">{formatValue(row.avg, row.name)}</span>
                <span className={`ml-2 text-xs ${bias}`}>
                  {vs >= 0 ? "▲" : "▼"} {Math.abs(vs * 100).toFixed(1)}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
