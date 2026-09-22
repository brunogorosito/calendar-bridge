import { useEffect, useState } from "react";
import { Clock, Sparkles } from "lucide-react";
import { api } from "../lib/api.js";
import { todayISO, parseISO, toISO, addDays, fmtTime, providerLabel } from "../lib/utils.js";

export function SuggestView() {
  const [duration, setDuration] = useState(60);
  const [rangeDays, setRangeDays] = useState(7);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const start = `${todayISO()}T09:00:00`;
    const end = `${toISO(addDays(parseISO(todayISO()), rangeDays))}T18:00:00`;
    api
      .suggestSlots(start, end, duration, 15)
      .then((d) => {
        if (!cancelled) setSlots(d.slots || []);
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
  }, [duration, rangeDays]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <h2 className="font-semibold text-slate-100 flex items-center gap-2">
          <Sparkles size={16} className="text-slate-400" /> Horarios libres sugeridos
        </h2>
        <div className="flex gap-3 flex-wrap">
          <label className="text-sm text-slate-400 flex items-center gap-2">
            Duración
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm"
            >
              {[30, 45, 60, 90, 120, 180].map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-400 flex items-center gap-2">
            Próximos
            <select
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm"
            >
              {[3, 5, 7, 14].map((d) => (
                <option key={d} value={d}>
                  {d} días
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
          Error: {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-12 w-full" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="text-sm text-slate-600 py-8 text-center">No hay horarios libres en el rango.</div>
      ) : (
        <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          {slots.map((s, i) => {
            const d = new Date(s.start);
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-1 h-10 rounded-full bg-emerald-500`} />
                <div className="w-24">
                  <div className="text-sm font-medium text-slate-200">
                    {d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Clock size={14} className="text-slate-500" />
                  {fmtTime(s.start)} – {fmtTime(s.end)}
                </div>
                <div className="ml-auto text-[11px] text-slate-500">
                  {duration} min · hueco {Math.round((new Date(s.free_to) - new Date(s.free_from)) / 60000)} min
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}