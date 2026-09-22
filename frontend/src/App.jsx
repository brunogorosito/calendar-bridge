import { useEffect, useState } from "react";
import { CalendarDays, Inbox, Link2, RefreshCw } from "lucide-react";
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

  async function doRefresh() {
    setSyncing(true);
    try {
      await Promise.allSettled([api.refresh(), api.syncIcs()]);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <CalendarDays size={20} />
            </div>
            <div>
              <h1 className="font-bold leading-tight">Calendar Bridge</h1>
              <p className="text-xs text-slate-400 leading-tight">Google + Outlook unificados</p>
            </div>
          </div>
          <button
            onClick={doRefresh}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm disabled:opacity-50 transition"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            Sincronizar
          </button>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-t-lg border-b-2 transition ${
                  active
                    ? "text-blue-300 border-blue-500 bg-slate-800/40"
                    : "text-slate-400 border-transparent hover:text-slate-200"
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "calendar" && <CalendarView />}
        {tab === "inbox" && <InboxView />}
        {tab === "accounts" && <AccountsView />}
      </main>
    </div>
  );
}