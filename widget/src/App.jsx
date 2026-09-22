import { useEffect, useState } from "react";
import { Link2, RefreshCw, Settings, X } from "lucide-react";
import { api, getApiBase, setApiBase } from "./lib/api.js";
import { todayISO } from "./lib/utils.js";
import { TodayCard } from "./components/TodayCard.jsx";
import { WeekStrip } from "./components/WeekStrip.jsx";
import { SettingsModal } from "./components/SettingsModal.jsx";

export default function App() {
  const [today, setToday] = useState(null);
  const [week, setWeek] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const date = todayISO();
      const [t, w, acc] = await Promise.allSettled([
        api.day(date),
        api.week(date),
        api.accounts(),
      ]);
      if (t.status === "fulfilled") setToday(t.value);
      if (w.status === "fulfilled") setWeek(w.value);
      if (acc.status === "fulfilled") setAccounts(acc.value);
      if (t.status === "rejected") setError(t.reason.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function doRefresh() {
    setRefreshing(true);
    try {
      await Promise.allSettled([api.refresh(), api.syncIcs()]);
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }

  const hasAccounts = accounts.length > 0;

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm">
            ☕
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">Calendar Bridge</div>
            <div className="text-[11px] text-slate-500">widget</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={doRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
            aria-label="Sincronizar"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg hover:bg-slate-800 transition"
            aria-label="Ajustes"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-6 space-y-3">
        {error && !hasAccounts && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs px-3 py-2.5">
            No se pudo conectar a la API: {error}
            <button onClick={() => setShowSettings(true)} className="ml-2 underline">
              configurar
            </button>
          </div>
        )}

        {!hasAccounts && !error && !loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center space-y-3">
            <p className="text-sm text-slate-300">
              Vinculá tu cuenta para ver tu disponibilidad.
            </p>
            <button
              onClick={() => setShowAccounts(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition"
            >
              <Link2 size={16} /> Vincular cuentas
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs text-slate-500 underline"
            >
              configurar URL de la API
            </button>
          </div>
        )}

        {loading && (
          <div className="text-slate-500 text-sm py-8 text-center">Cargando…</div>
        )}

        {!loading && today && <TodayCard day={today} />}
        {!loading && week && <WeekStrip week={week} />}

        {!loading && today && (
          <div className="text-[11px] text-slate-600 text-center pt-1">
            Sync automático cada 15 min · API: {getApiBase() || "proxy dev"}
          </div>
        )}
      </main>

      {showAccounts && (
        <Modal title="Vincular cuentas" onClose={() => setShowAccounts(false)}>
          <p className="text-xs text-slate-400 mb-3">
            Abrí el flujo de OAuth en el navegador del sistema. Al autorizar, volvé al widget y tocá
            "Listo".
          </p>
          {["google", "microsoft"].map((p) => {
            const linked = accounts.find((a) => a.provider === p);
            return (
              <a
                key={p}
                href={api.login(p)}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between px-3 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition mb-2"
              >
                <span className="text-sm capitalize font-medium">
                  {p === "google" ? "Google" : "Microsoft"}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${linked ? "bg-green-500/20 text-green-300" : "bg-slate-700 text-slate-400"}`}>
                  {linked ? linked.provider_email : "no vinculado"}
                </span>
              </a>
            );
          })}
          <button
            onClick={async () => {
              await load(true);
              setShowAccounts(false);
            }}
            className="w-full mt-2 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition"
          >
            Listo
          </button>
        </Modal>
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSave={() => {
            setShowSettings(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-20 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 transition">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}