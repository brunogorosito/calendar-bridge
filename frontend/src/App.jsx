import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Inbox, Link2, RefreshCw, XCircle } from "lucide-react";
import { api } from "./lib/api.js";
import { CalendarView } from "./components/CalendarView.jsx";
import { InboxView } from "./components/InboxView.jsx";
import { AccountsView } from "./components/AccountsView.jsx";

const TABS = [
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "accounts", label: "Cuentas", icon: Link2 },
];

export default function App() {
  const [tab, setTab] = useState("calendar");
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = useCallback((type, msg) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  async function doRefresh() {
    setSyncing(true);
    try {
      const [cal, ics] = await Promise.allSettled([api.refresh(), api.syncIcs()]);
      if (cal.status === "fulfilled" && ics.status === "fulfilled") {
        const n = cal.value?.synced?.[0]?.calendars?.[0]?.events ?? 0;
        notify("success", `Sincronizado · ${n} eventos`);
      } else {
        notify("error", "Algo falló al sincronizar");
      }
    } catch {
      notify("error", "No se pudo sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <CalendarDays size={22} className="text-white" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight tracking-tight">Calendar Bridge</h1>
                <p className="text-xs text-slate-400 leading-tight">Google · Outlook · unificados</p>
              </div>
            </div>

            <button
              onClick={doRefresh}
              disabled={syncing}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-sm font-medium border border-white/5 transition disabled:opacity-50 active:scale-95"
            >
              <RefreshCw size={16} className={syncing ? "animate-spin text-blue-400" : "text-slate-400 group-hover:text-blue-300 transition"} />
              <span className="hidden sm:inline">{syncing ? "Sincronizando…" : "Sincronizar"}</span>
            </button>
          </div>

          <nav className="flex gap-1 -mb-px">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${
                    active ? "text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon size={16} className={active ? "text-blue-400" : ""} />
                  {t.label}
                  {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-6">
        <div key={tab} className="animate-fade-up">
          {tab === "calendar" && <CalendarView />}
          {tab === "inbox" && <InboxView />}
          {tab === "accounts" && <AccountsView />}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl border ${
              toast.type === "success"
                ? "bg-slate-900 border-emerald-500/30 text-emerald-200"
                : "bg-slate-900 border-red-500/30 text-red-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={18} className="text-emerald-400" />
            ) : (
              <XCircle size={18} className="text-red-400" />
            )}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}