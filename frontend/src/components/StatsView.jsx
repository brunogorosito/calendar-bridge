import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { api } from "../lib/api.js";
import { todayISO, parseISO, toISO, addDays, fmtMinutes, providerLabel, providerColor } from "../lib/utils.js";

export function StatsView() {
  const [range, setRange] = useState("7d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const end = `${todayISO()}T23:59:59`;
    const start = `${toISO(addDays(parseISO(todayISO()), -days))}T00:00:00`;
    api
      .stats(start, end)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const maxDay = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...Object.values(data.by_day).map(Number));
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-100 flex items-center gap-2">
          <BarChart3 size={16} className="text-slate-400" /> Estadísticas de reuniones
        </h2>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm"
        >
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
          Error: {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      ) : (
        data && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                <div className="text-xl font-semibold text-slate-100">{data.total_meetings}</div>
                <div className="text-xs text-slate-500">Reuniones</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                <div className="text-xl font-semibold text-slate-100">{fmtMinutes(data.total_busy_minutes)}</div>
                <div className="text-xs text-slate-500">En reuniones</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                <div className="text-xl font-semibold text-slate-100">{data.workable_days}</div>
                <div className="text-xs text-slate-500">Días laborables</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Por cuenta</h3>
              <div className="space-y-2">
                {data.by_account.map((a) => {
                  const c = providerColor(a.provider, a.client_name);
                  const pct = data.total_busy_minutes
                    ? Math.round((a.minutes / data.total_busy_minutes) * 100)
                    : 0;
                  return (
                    <div key={a.email || a.provider} className="flex items-center gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${c.bg} ${c.border} ${c.text}`}>
                        {a.email || providerLabel(a.provider)}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full ${c.solid}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-24 text-right">
                        {fmtMinutes(a.minutes)} · {a.meetings} reu
                      </span>
                    </div>
                  );
                })}
                {data.by_account.length === 0 && (
                  <div className="text-sm text-slate-600 py-2">Sin reuniones en el periodo.</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Minutos por día</h3>
              {Object.keys(data.by_day).length === 0 ? (
                <div className="text-sm text-slate-600 py-2">Sin datos.</div>
              ) : (
                <div className="flex items-end gap-1 h-28">
                  {Object.entries(data.by_day)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, min]) => (
                      <div key={date} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-slate-500">{Math.round(min / 60 * 10) / 10}h</span>
                        <div
                          className="w-full bg-slate-600 rounded-t transition-all"
                          style={{ height: `${(min / maxDay) * 80}px` }}
                        />
                        <span className="text-[9px] text-slate-600">
                          {new Date(date + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}