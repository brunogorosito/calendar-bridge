import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../lib/api.js";
import { TZ, fmtTime, parseISO, todayISO, toISO, addDays, mondayOf, monthStartOf, fmtDayLong, providerLabel, providerColor } from "../lib/utils.js";

const VIEWS = ["day", "week", "month"];

export function CalendarView() {
  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(parseISO(todayISO()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const anchorISO = toISO(anchor);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let cancelled = false;
    const load = async () => {
      try {
        if (view === "day") {
          const d = await api.day(anchorISO, TZ);
          if (!cancelled) setData({ type: "day", days: [d] });
        } else if (view === "week") {
          const w = await api.week(toISO(mondayOf(anchor)), TZ);
          if (!cancelled) setData({ type: "week", days: w.days });
        } else {
          const m = await api.month(toISO(monthStartOf(anchor)), TZ);
          if (!cancelled) setData({ type: "month", weeks: m.weeks });
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [view, anchorISO]);

  const navigate = (dir) => {
    const d = new Date(anchor);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  };

  const title = useMemo(() => {
    if (!data) return "";
    if (view === "day") return fmtDayLong(data.days[0].date);
    if (view === "week") {
      const first = data.days[0].date;
      const last = data.days[6].date;
      return `${fmtDayLong(first)} — ${fmtDayLong(last)}`;
    }
    const d = parseISO(anchorISO);
    return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  }, [data, view, anchorISO]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 text-sm capitalize transition ${
                view === v ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium capitalize min-w-44 text-center">{title}</span>
          <button onClick={() => navigate(1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition">
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setAnchor(parseISO(todayISO()))}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition"
          >
            Hoy
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
          Error: {error}
        </div>
      )}

      {loading && <div className="text-slate-400 text-sm py-10 text-center">Cargando…</div>}

      {!loading && data && (
        <>
          {data.type === "day" && <DayView day={data.days[0]} />}
          {data.type === "week" && <WeekView days={data.days} />}
          {data.type === "month" && <MonthView weeks={data.weeks} />}
        </>
      )}
    </div>
  );
}

function DayView({ day }) {
  const ws = parseHours(day.work_start);
  const we = parseHours(day.work_end);
  const hours = [];
  for (let h = ws; h < we; h++) hours.push(h);
  const byHour = {};
  day.blocks.forEach((b) => {
    const h = b.busy ? parseInt(b.start.slice(11, 13), 10) : null;
    if (h !== null) (byHour[h] = byHour[h] || []).push(b);
  });
  return (
    <div className="space-y-3">
      <SummaryBar day={day} />
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800/60">
        {hours.map((h) => (
          <div key={h} className="grid grid-cols-[56px_1fr] min-h-12">
            <div className="px-3 py-1.5 text-xs text-slate-500 border-r border-slate-800/60 flex items-start justify-end pt-1.5">
              {String(h).padStart(2, "0")}:00
            </div>
            <div className="relative px-2 py-1">
              {(byHour[h] || []).map((b, i) => (
                <Block key={i} b={b} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekView({ days }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => (
          <DayCard key={d.date} day={d} />
        ))}
      </div>
    </div>
  );
}

function MonthView({ weeks }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((x) => (
          <div key={x} className="py-1">{x}</div>
        ))}
      </div>
      {weeks.map((week, i) => (
        <div key={i} className="grid grid-cols-7 gap-1">
          {week.map((d) => (
            <div
              key={d.date}
              className={`rounded-lg border p-1.5 min-h-20 ${
                d.date === todayISO()
                  ? "border-blue-500/50 bg-blue-500/5"
                  : "border-slate-800 bg-slate-900/40"
              }`}
            >
              <div className="text-xs text-slate-400 mb-1">{parseInt(d.date.slice(8, 10), 10)}</div>
              {d.blocks.slice(0, 3).map((b, i) => (
                <div
                  key={i}
                  className="text-[10px] truncate rounded px-1 py-0.5 mb-0.5"
                  style={{ background: b.busy ? "rgba(59,130,246,.25)" : "rgba(34,197,94,.15)", color: b.busy ? "#93c5fd" : "#86efac" }}
                >
                  {b.busy ? `${fmtTime(b.start)} ${b.source === "google" ? "G" : "O"}` : "libre"}
                </div>
              ))}
              {d.blocks.length > 3 && (
                <div className="text-[10px] text-slate-500">+{d.blocks.length - 3} más</div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DayCard({ day }) {
  const isToday = day.date === todayISO();
  return (
    <div
      className={`rounded-xl border p-2 ${
        isToday ? "border-blue-500/50 bg-blue-500/5" : "border-slate-800 bg-slate-900/40"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium capitalize">{parseISO(day.date).toLocaleDateString("es-AR", { weekday: "short" })}</span>
        <span className="text-xs text-slate-500">{parseInt(day.date.slice(8, 10), 10)}</span>
      </div>
      <div className="text-[11px] text-slate-400 mb-1">
        {day.busy_minutes > 0 ? `${day.busy_minutes} min ocupado` : "Libre"}
      </div>
      <div className="space-y-1">
        {day.blocks.map((b, i) => (
          <Block key={i} b={b} compact />
        ))}
      </div>
    </div>
  );
}

function Block({ b, compact = false }) {
  if (!b.busy) return null;
  return (
    <div
      className={`rounded-md border ${providerColor(b.source)} ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}`}
    >
      <span className="font-medium">{fmtTime(b.start)}–{fmtTime(b.end)}</span>
      <span className="ml-1.5 opacity-70">{providerLabel(b.source)}</span>
    </div>
  );
}

function SummaryBar({ day }) {
  const total = day.busy_minutes + day.free_minutes;
  const pct = total ? Math.round((day.busy_minutes / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex justify-between text-sm mb-2">
        <span className="font-medium capitalize">{fmtDayLong(day.date)}</span>
        <span className="text-slate-400">
          <span className="text-blue-300 font-semibold">{day.busy_minutes} min</span> ocupado ·{" "}
          <span className="text-green-300 font-semibold">{day.free_minutes} min</span> libre
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function parseHours(hhmm) {
  return parseInt(hhmm.slice(0, 2), 10);
}