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

export function fmtDayLong(iso) {
  const d = parseISO(iso);
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

export function providerLabel(p) {
  return p === "google" ? "Google" : p === "microsoft" ? "Outlook/Teams" : p === "microsoft_ics" ? "Aunesa (ICS)" : p;
}

export function providerColor(p) {
  if (p === "google") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (p === "microsoft" || p === "microsoft_ics") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  return "bg-slate-500/20 text-slate-300 border-slate-500/30";
}