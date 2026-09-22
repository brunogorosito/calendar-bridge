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
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                <CalendarDays size={18} className="text-slate-300" />
              </div>
              <div>
                <h1 className="font-semibold text-[15px] leading-tight tracking-tight text-slate-100">
                  Calendar Bridge
                </h1>
                <p className="text-xs text-slate-500 leading-tight">Google · Outlook</p>
              </div>
            </div>

            <button
              onClick={doRefresh}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 border border-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw size={15} className={syncing ? "animate-spin text-slate-400" : "text-slate-400"} />
              <span className="hidden sm:inline">{syncing ? "Sincronizando…" : "Sincronizar"}</span>
            </button>
          </div>

          <nav className="flex gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2.5 text-sm transition ${
                    active ? "text-slate-100" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Icon size={15} className={active ? "text-slate-300" : ""} />
                  {t.label}
                  {active && <span className="absolute inset-x-2 bottom-0 h-px bg-slate-400" />}
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
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg border ${
              toast.type === "success"
                ? "bg-slate-900 border-slate-700 text-slate-200"
                : "bg-slate-900 border-red-500/40 text-red-300"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : (
              <XCircle size={16} className="text-red-400" />
            )}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}