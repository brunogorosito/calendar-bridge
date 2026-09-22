import { useEffect, useState } from "react";
import { ExternalLink, Link2, Unlink } from "lucide-react";
import { api } from "../lib/api.js";
import { providerLabel, providerColor } from "../lib/utils.js";

const PROVIDERS = [
  { id: "google", name: "Google", desc: "Calendar + Gmail" },
  { id: "microsoft", name: "Microsoft", desc: "Outlook + Teams" },
];

export function AccountsView() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setAccounts(await api.accounts());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const linked = (p) => accounts.find((a) => a.provider === p);

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-slate-400">
        Vinculá tus cuentas de Google y Microsoft. Al hacer click se abre el flujo de autorización.
      </p>

      {loading && <div className="text-slate-400 text-sm py-6 text-center">Cargando…</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map((p) => {
          const acc = linked(p.id);
          return (
            <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <Link2 size={16} className="text-slate-400" />
                    {p.name}
                  </div>
                  <div className="text-xs text-slate-500">{p.desc}</div>
                </div>
                {acc && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${providerColor(p.id)}`}>Conectado</span>}
              </div>

              {acc ? (
                <div className="text-sm">
                  <div className="text-slate-300 truncate">{acc.provider_email}</div>
                  <div className="text-xs text-slate-500 mt-1">Permisos: {acc.scopes.length}</div>
                  <button
                    onClick={() => window.open(`/api/v1/auth/${p.id}/login`, "_self")}
                    className="mt-3 flex items-center gap-2 text-xs text-blue-300 hover:text-blue-200"
                  >
                    <ExternalLink size={14} /> Reconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => window.open(`/api/v1/auth/${p.id}/login`, "_self")}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition"
                >
                  <Link2 size={16} /> Vincular {p.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {accounts.some((a) => a.provider === "microsoft_ics") ? null : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
          <span className="font-medium text-slate-300">Calendario Outlook (ICS):</span> si configuraste{" "}
          <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">OUTLOOK_ICS_URL</code>, se sincroniza
          automáticamente con el worker.
        </div>
      )}
    </div>
  );
}