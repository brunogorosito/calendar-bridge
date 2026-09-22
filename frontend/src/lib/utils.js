export const TZ = "America/Argentina/Buenos_Aires";

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function parseISO(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function mondayOf(d) {
  const c = new Date(d);
  const day = c.getDay() || 7;
  c.setDate(c.getDate() - (day - 1));
  return c;
}

export function monthStartOf(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function fmtTime(iso) {
  if (!iso) return "";
  return iso.slice(11, 16);
}

export function fmtMinutes(min) {
  if (!min || min < 60) return `${min || 0} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtDayLong(iso) {
  const d = parseISO(iso);
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

export function fmtDayShort(iso) {
  return parseISO(iso).toLocaleDateString("es-AR", { weekday: "short" });
}

export function fmtRelativeDay(iso) {
  const today = todayISO();
  if (iso === today) return "Hoy";
  const d = parseISO(iso);
  const t = parseISO(today);
  const diff = Math.round((d - t) / 86400000);
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  return fmtDayLong(iso);
}

export function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

export function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function providerLabel(p) {
  if (p === "google") return "Google";
  if (p === "microsoft") return "Outlook";
  if (p === "microsoft_ics") return "Aunesa";
  return p;
}

export function providerShort(p) {
  if (p === "google") return "G";
  if (p === "microsoft" || p === "microsoft_ics") return "O";
  return "?";
}

export function providerColor(p) {
  if (p === "google") return { text: "text-blue-300", bg: "bg-blue-500/15", border: "border-blue-500/30", dot: "bg-blue-500", solid: "bg-blue-500" };
  if (p === "microsoft" || p === "microsoft_ics") return { text: "text-purple-300", bg: "bg-purple-500/15", border: "border-purple-500/30", dot: "bg-purple-500", solid: "bg-purple-500" };
  return { text: "text-slate-300", bg: "bg-slate-500/15", border: "border-slate-500/30", dot: "bg-slate-500", solid: "bg-slate-500" };
}

const AVATAR_COLORS = ["bg-blue-600", "bg-emerald-600", "bg-fuchsia-600", "bg-amber-600", "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-lime-600"];

export function avatarColor(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}