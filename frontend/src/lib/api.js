const BASE = "/api/v1";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  accounts: () => req("/auth/accounts"),
  login: (provider) => req(`/auth/${provider}/login`),
  refresh: () => req("/auth/refresh", { method: "POST" }),
  syncIcs: () => req("/auth/sync/ics", { method: "POST" }),
  events: (start, end, provider) =>
    req(`/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}${provider ? `&provider=${provider}` : ""}`),
  day: (date, tz = "UTC", ws = "09:00", we = "18:00") =>
    req(`/calendar/day/${date}?tz=${encodeURIComponent(tz)}&work_start=${ws}&work_end=${we}`),
  week: (date, tz = "UTC", ws = "09:00", we = "18:00") =>
    req(`/calendar/week/${date}?tz=${encodeURIComponent(tz)}&work_start=${ws}&work_end=${we}`),
  month: (date, tz = "UTC", ws = "09:00", we = "18:00") =>
    req(`/calendar/month/${date}?tz=${encodeURIComponent(tz)}&work_start=${ws}&work_end=${we}`),
  inbox: (limit = 50, unreadOnly = false, search = "") =>
    req(`/inbox?limit=${limit}&unread_only=${unreadOnly}${search ? `&search=${encodeURIComponent(search)}` : ""}`),
};