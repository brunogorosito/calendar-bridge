const STORAGE_KEY = "cb_api_base";

export function getApiBase() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved.replace(/\/$/, "");
  // En web dev el proxy de Vite maneja /api. En la app nativa se debe configurar.
  return import.meta.env.DEV ? "" : "http://localhost:8000";
}

export function setApiBase(url) {
  localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ""));
}

async function req(path, opts = {}) {
  const base = getApiBase();
  const res = await fetch(`${base}/api/v1${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: async () => {
    const base = getApiBase();
    const res = await fetch(`${base}/health`);
    return res.json();
  },
  accounts: () => req("/auth/accounts"),
  googleClients: () => req("/auth/google/clients"),
  login: (provider, client) => `${getApiBase()}/api/v1/auth/${provider}/login${client ? `?client=${client}` : ""}`,
  refresh: () => req("/auth/refresh", { method: "POST" }),
  syncIcs: () => req("/auth/sync/ics", { method: "POST" }),
  day: (date, tz = "America/Argentina/Buenos_Aires", ws = "09:00", we = "18:00") =>
    req(`/calendar/day/${date}?tz=${encodeURIComponent(tz)}&work_start=${ws}&work_end=${we}`),
  week: (date, tz = "America/Argentina/Buenos_Aires", ws = "09:00", we = "18:00") =>
    req(`/calendar/week/${date}?tz=${encodeURIComponent(tz)}&work_start=${ws}&work_end=${we}`),
  events: (start, end) =>
    req(`/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  inbox: (limit = 20) => req(`/inbox?limit=${limit}`),
};