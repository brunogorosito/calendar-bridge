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

export function fmtDayShort(iso) {
  return parseISO(iso).toLocaleDateString("es-AR", { weekday: "short" });
}

export function fmtDayNum(iso) {
  return String(parseInt(iso.slice(8, 10), 10));
}

export function providerShort(p) {
  if (p === "google") return "G";
  if (p === "microsoft" || p === "microsoft_ics") return "O";
  if (p === "lunch") return "☕";
  return "?";
}