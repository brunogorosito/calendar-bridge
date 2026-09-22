import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  Video,
  X,
} from "lucide-react";
import { api } from "../lib/api.js";
import {
  TZ,
  fmtTime,
  parseISO,
  todayISO,
  toISO,
  addDays,
  mondayOf,
  monthStartOf,
  fmtDayLong,
  fmtDayShort,
  fmtMinutes,
  fmtRelativeDay,
  providerLabel,
  providerColor,
  providerShort,
} from "../lib/utils.js";

const VIEWS = ["day", "week", "month"];

export function CalendarView() {
  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(() => parseISO(todayISO()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const anchorISO = toISO(anchor);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        let result;
        if (view === "day") {
          result = { type: "day", days: [await api.day(anchorISO, TZ)] };
        } else if (view === "week") {
          result = { type: "week", days: (await api.week(toISO(mondayOf(anchor)), TZ)).days };
        } else {
          result = { type: "month", weeks: (await api.month(toISO(monthStartOf(anchor)), TZ)).weeks };
        }
        if (!cancelled) setData(result);
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

  const navigate = useCallback(
    (dir) => {
      const d = new Date(anchor);
      if (view === "day") d.setDate(d.getDate() + dir);
      else if (view === "week") d.setDate(d.getDate() + 7 * dir);
      else d.setMonth(d.getMonth() + dir);
      setAnchor(d);
    },
    [view, anchor]
  );

  const goToday = () => setAnchor(parseISO(todayISO()));

  const title = useMemo(() => {
    if (!data) return "";
    if (data.type === "day") return fmtDayLong(data.days[0].date);
    if (data.type === "week") {
      return `${fmtRelativeDay(data.days[0].date)} – ${fmtRelativeDay(data.days[6].date)}`;
    }
    return parseISO(anchorISO).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  }, [data, anchorISO]);

  const totals = useMemo(() => {
    if (!data) return null;
    const days = data.type === "month" ? data.weeks.flat() : data.days;
    const busy = days.reduce((a, d) => a + (d.busy_minutes || 0), 0);
    const free = days.reduce((a, d) => a + (d.free_minutes || 0), 0);
    const ev = days.reduce((a, d) => a + d.blocks.filter((b) => b.busy && b.source !== "lunch").length, 0);
    return { busy, free, events: ev };
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-slate-900/50 p-1">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition capitalize ${
                view === v ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-white/5 transition active:scale-95">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold capitalize min-w-44 text-center text-slate-200">{title}</span>
          <button onClick={() => navigate(1)} className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-white/5 transition active:scale-95">
            <ChevronRight size={18} />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-white/5 text-sm transition active:scale-95"
          >
            Hoy
          </button>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Reuniones" value={totals.events} accent="text-blue-300" />
          <StatCard label="Ocupado" value={fmtMinutes(totals.busy)} accent="text-amber-300" />
          <StatCard label="Libre" value={fmtMinutes(totals.free)} accent="text-emerald-300" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
          Error: {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-10 w-1/2" />
          <div className="skeleton h-64 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      ) : (
        data && (
          <>
            {data.type === "day" && <DayView day={data.days[0]} onSelect={setSelected} />}
            {data.type === "week" && <WeekView days={data.days} onSelect={setSelected} />}
            {data.type === "month" && <MonthView weeks={data.weeks} onSelect={setSelected} />}
          </>
        )
      )}

      {selected && <EventModal block={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

/* ---------- DAY VIEW ---------- */

function DayView({ day, onSelect }) {
  const ws = parseHours(day.work_start);
  const we = parseHours(day.work_end);
  const busyBlocks = day.blocks.filter((b) => b.busy);

  const hours = [];
  for (let h = ws; h < we; h++) hours.push(h);

  if (!day.is_workday) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-8 text-center text-slate-500">
        <div className="text-3xl mb-2">{day.holiday ? "🎉" : "🏖️"}</div>
        <div className="font-semibold capitalize text-slate-300">{fmtRelativeDay(day.date)}</div>
        <div className="text-sm mt-1">{day.holiday ? `Feriado: ${day.holiday}` : "Día no laboral"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 flex items-center justify-between">
        <div>
          <div className="font-semibold capitalize">{fmtRelativeDay(day.date)}</div>
          <div className="text-xs text-slate-400">
            {fmtMinutes(day.busy_minutes)} ocupado · {fmtMinutes(day.free_minutes)} libre
          </div>
        </div>
        <LoadBar busy={day.busy_minutes} free={day.free_minutes} />
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-900/30 overflow-hidden">
        {hours.map((h) => {
          const atHour = busyBlocks.filter((b) => parseInt(b.start.slice(11, 13), 10) === h);
          const now = new Date();
          const isNow = viewIsToday(day.date) && now.getHours() === h;
          return (
            <div
              key={h}
              className={`relative grid grid-cols-[64px_1fr] min-h-14 border-b border-white/5 last:border-0 ${
                isNow ? "bg-blue-500/5" : ""
              }`}
            >
              <div className="px-3 py-1.5 text-[11px] font-medium text-slate-500 border-r border-white/5 flex items-start justify-end pt-2">
                {String(h).padStart(2, "0")}:00
              </div>
              <div className="relative px-2 py-1 space-y-1">
                {atHour.map((b, i) => (
                  <EventChip key={i} b={b} onClick={() => onSelect(b)} />
                ))}
                {isNow && <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500/70" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- WEEK VIEW ---------- */

function WeekView({ days, onSelect }) {
  const ws = 9;
  const we = 18;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const isToday = d.date === todayISO();
          const isWeekend = d.is_workday === false;
          return (
            <div
              key={d.date}
              className={`rounded-2xl border p-3 ${
                isToday ? "border-blue-500/40 bg-blue-500/5" : isWeekend ? "border-white/5 bg-slate-900/20 opacity-60" : "border-white/5 bg-slate-900/40"
              }`}
            >
              <div className="text-center mb-2">
                <div className={`text-xs font-medium capitalize ${isToday ? "text-blue-300" : "text-slate-400"}`}>
                  {fmtDayShort(d.date)}
                </div>
                <div className={`text-xl font-bold ${isToday ? "text-blue-300" : ""}`}>{parseInt(d.date.slice(8, 10), 10)}</div>
              </div>
              {isWeekend ? (
                <div className="text-[10px] text-slate-600 text-center pt-3">
                  {d.holiday ? `🎉 ${d.holiday}` : "no laboral"}
                </div>
              ) : (
                <div className="space-y-1">
                  {d.blocks
                    .filter((b) => b.busy)
                    .slice(0, 6)
                    .map((b, i) => {
                      const isLunch = b.source === "lunch";
                      return (
                        <button
                          key={i}
                          onClick={() => onSelect(b)}
                          className={`w-full text-left rounded-lg px-2 py-1 text-[10px] leading-tight border transition hover:opacity-80 ${
                            isLunch ? "border-amber-500/20 bg-amber-500/10" : "border-white/5 bg-blue-500/10"
                          }`}
                        >
                          <div className={`font-medium ${isLunch ? "text-amber-200" : "text-blue-200"}`}>
                            {fmtTime(b.start)} {b.summary}
                          </div>
                        </button>
                      );
                    })}
                  {d.blocks.filter((b) => b.busy).length > 6 && (
                    <div className="text-[10px] text-slate-500 px-1">
                      +{d.blocks.filter((b) => b.busy).length - 6} más
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Agenda compacta */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock size={15} className="text-blue-400" /> Agenda de la semana
        </h3>
        <div className="space-y-1.5">
          {days
            .flatMap((d) => d.blocks.filter((b) => b.busy && b.source !== "lunch").map((b) => ({ ...b, date: d.date })))
            .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
            .map((b, i) => (
              <button
                key={i}
                onClick={() => onSelect(b)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-800/50 transition text-left"
              >
                <span className={`w-1.5 h-8 rounded-full ${providerColor(b.source).solid}`} />
                <span className="text-xs text-slate-400 w-14 shrink-0 font-medium">
                  {fmtDayShort(b.date)} {fmtTime(b.start)}
                </span>
                <span className="text-sm font-medium truncate">{b.summary}</span>
                <span className="ml-auto text-[10px] text-slate-500 shrink-0">{providerLabel(b.source)}</span>
              </button>
            ))}
          {days.every((d) => !d.blocks.some((b) => b.busy && b.source !== "lunch")) && (
            <div className="text-sm text-slate-500 py-4 text-center">Semana libre 🎉</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- MONTH VIEW ---------- */

function MonthView({ weeks, onSelect }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-slate-500">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((x) => (
          <div key={x} className="py-1.5">{x}</div>
        ))}
      </div>
      {weeks.map((week, i) => (
        <div key={i} className="grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const isToday = d.date === todayISO();
            const busy = d.blocks.filter((b) => b.busy && b.source !== "lunch");
            const hasLunch = d.blocks.some((b) => b.source === "lunch");
            const load = d.busy_minutes + d.free_minutes
              ? Math.min(1, d.busy_minutes / (d.busy_minutes + d.free_minutes))
              : 0;
            return (
              <div
                key={d.date}
                className={`rounded-xl border p-1.5 min-h-24 transition hover:border-blue-500/40 ${
                  isToday ? "border-blue-500/50 bg-blue-500/5" : d.is_workday === false ? "border-white/5 bg-slate-900/20 opacity-60" : "border-white/5 bg-slate-900/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1 px-0.5">
                  <span className={`text-xs font-semibold ${isToday ? "text-blue-300" : "text-slate-400"}`}>
                    {parseInt(d.date.slice(8, 10), 10)}
                  </span>
                  {d.is_workday === false ? (
                    <span className="text-[9px] text-slate-600">{d.holiday ? "🎉 feriado" : "no laboral"}</span>
                  ) : (
                    busy.length + (hasLunch ? 1 : 0) > 0 && (
                      <span className="text-[10px] text-slate-500">{fmtMinutes(d.busy_minutes)}</span>
                    )
                  )}
                </div>
                <div className="h-0.5 rounded-full bg-slate-800 mb-1.5 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${Math.max(load * 100, busy.length ? 8 : 0)}%` }} />
                </div>
                {d.is_workday !== false && (
                  <div className="space-y-0.5">
                    {hasLunch && (
                      <div className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px]" style={{ background: "rgba(245,158,11,.15)" }}>
                        <span className="text-[8px] font-bold text-amber-300">☕</span>
                        <span className="truncate text-amber-200">Almuerzo</span>
                      </div>
                    )}
                    {busy.slice(0, 2).map((b, j) => (
                      <button
                        key={j}
                        onClick={() => onSelect(b)}
                        className="w-full flex items-center gap-1 text-left rounded px-1 py-0.5 text-[10px] hover:opacity-80 transition"
                        style={{ background: b.source === "google" ? "rgba(59,130,246,.15)" : "rgba(168,85,247,.15)" }}
                      >
                        <span className={`text-[8px] font-bold ${providerColor(b.source).text}`}>{providerShort(b.source)}</span>
                        <span className="truncate text-slate-300">{fmtTime(b.start)} {b.summary}</span>
                      </button>
                    ))}
                    {busy.length > 2 && (
                      <div className="text-[10px] text-slate-500 px-1">+{busy.length - 2} más</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ---------- SHARED ---------- */

function EventChip({ b, onClick }) {
  const c = providerColor(b.source);
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 text-left rounded-lg px-2.5 py-1.5 border ${c.bg} ${c.border} transition hover:brightness-110 active:scale-[0.99]`}
    >
      <span className={`font-medium ${c.text} text-xs`}>{fmtTime(b.start)}–{fmtTime(b.end)}</span>
      <span className="text-xs truncate text-slate-200">{b.summary}</span>
      {b.online_meeting_url && <Video size={12} className="ml-auto shrink-0 text-slate-400" />}
    </button>
  );
}

function LoadBar({ busy, free }) {
  const total = busy + free;
  const pct = total ? Math.round((busy / total) * 100) : 0;
  return (
    <div className="w-40">
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-blue-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-slate-500 mt-1 text-right">
        {pct}% ocupado
      </div>
    </div>
  );
}

function EventModal({ block, onClose }) {
  const c = providerColor(block.source);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl animate-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${c.solid}`} />
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${c.text}`}>{providerLabel(block.source)}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 transition">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <h2 className="text-lg font-bold mb-1">{block.summary || "Sin título"}</h2>
        <div className="flex items-center gap-2 text-sm text-slate-300 mb-3">
          <Clock size={15} className="text-slate-500" />
          <span>
            {fmtDayLong(block.start.slice(0, 10))} · {fmtTime(block.start)} – {fmtTime(block.end)}
          </span>
        </div>

        {block.location && (
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <MapPin size={15} className="text-slate-500" />
            {block.location}
          </div>
        )}

        {block.description && (
          <div className="rounded-xl bg-slate-800/50 border border-white/5 p-3 text-sm text-slate-300 whitespace-pre-line max-h-60 overflow-y-auto mb-4">
            {block.description}
          </div>
        )}

        {block.online_meeting_url && (
          <a
            href={block.online_meeting_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:brightness-110 text-sm font-semibold transition active:scale-[0.99]"
          >
            <Video size={16} /> Unirse a la reunión
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

function parseHours(hhmm) {
  return parseInt(hhmm.slice(0, 2), 10);
}

function viewIsToday(dateISO) {
  return dateISO === todayISO();
}