export default function GaugeBar({ value, accentClass }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/50 ring-1 ring-white/5">
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${accentClass}`}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
