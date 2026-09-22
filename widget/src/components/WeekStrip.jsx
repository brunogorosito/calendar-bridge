import { fmtDayShort, fmtDayNum, todayISO } from "../lib/utils.js";

export function WeekStrip({ week }) {
  const today = todayISO();
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="grid grid-cols-7 gap-1.5">
        {week.days.map((d) => {
          const isToday = d.date === today;
          const isWeekend = d.is_workday === false;
          const busy = d.busy_minutes > 0;
          const load = d.busy_minutes + d.free_minutes
            ? Math.min(1, d.busy_minutes / (d.busy_minutes + d.free_minutes))
            : 0;
          const firstBusy = d.blocks.find((b) => b.busy && b.source !== "lunch");
          return (
            <div
              key={d.date}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 ${
                isToday ? "bg-blue-500/15 ring-1 ring-blue-500/40" : isWeekend ? "bg-slate-800/20 opacity-50" : "bg-slate-800/40"
              }`}
            >
              <span className="text-[10px] text-slate-400 uppercase">{fmtDayShort(d.date)}</span>
              <span className={`text-sm font-semibold ${isToday ? "text-blue-300" : ""}`}>
                {fmtDayNum(d.date)}
              </span>
              <div className="w-6 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${busy ? "bg-blue-500" : "bg-green-500"}`}
                  style={{ width: `${Math.max(load * 100, busy ? 20 : 0)}%` }}
                />
              </div>
              {isWeekend ? (
                <span className="text-[8px] text-slate-600">{d.holiday ? "🎉" : "libre"}</span>
              ) : (
                firstBusy && (
                  <span className="text-[9px] leading-tight text-slate-400 line-clamp-2 text-center px-1">
                    {firstBusy.summary}
                  </span>
                )
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> libre
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> ocupado
        </span>
      </div>
    </div>
  );
}