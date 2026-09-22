import { fmtMinutes, fmtTime, parseISO } from "../lib/utils.js";

export function TodayCard({ day }) {
  const pct = day.busy_minutes + day.free_minutes
    ? Math.round((day.busy_minutes / (day.busy_minutes + day.free_minutes)) * 100)
    : 0;

  if (day.is_workday === false) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-center">
        <div className="text-3xl mb-1">🏖️</div>
        <div className="text-sm font-semibold capitalize">
          {parseISO(day.date).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}
        </div>
        <div className="text-xs text-slate-500 mt-1">Día no laboral</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold capitalize">
          {parseISO(day.date).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}
        </div>
        <div className="text-[11px] text-slate-400">
          {fmtMinutes(day.busy_minutes)} ocupado · {fmtMinutes(day.free_minutes)} libre
        </div>
      </div>

      <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-3">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      {day.blocks.length === 0 ? (
        <div className="text-xs text-slate-500 py-2">Día libre 🎉</div>
      ) : (
        <div className="space-y-1.5">
          {day.blocks
            .filter((b) => b.busy)
            .map((b, i) => (
              <Block key={i} b={b} />
            ))}
        </div>
      )}
    </div>
  );
}

export function Block({ b }) {
  const isLunch = b.source === "lunch";
  const style = isLunch
    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
    : b.source === "google"
      ? "border-blue-500/30 bg-blue-500/10 text-blue-200"
      : "border-purple-500/30 bg-purple-500/10 text-purple-200";
  return (
    <div className={`text-xs rounded-lg px-2.5 py-2 border ${style}`}>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="font-mono font-medium">{fmtTime(b.start)}–{fmtTime(b.end)}</span>
        {b.summary && <span className="font-semibold truncate">{b.summary}</span>}
      </div>
      {b.description && (
        <p className="text-[11px] leading-snug opacity-80 whitespace-pre-line line-clamp-3">
          {b.description}
        </p>
      )}
    </div>
  );
}