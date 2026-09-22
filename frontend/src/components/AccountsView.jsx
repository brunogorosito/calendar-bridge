import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "../lib/api.js";
import { providerColor, providerLabel } from "../lib/utils.js";

const PROVIDERS = [
  {
    id: "google",
    name: "Google",
    desc: "Calendar + Gmail",
    icon: "G",
  },
  {
    id: "microsoft",
    name: "Microsoft",
    desc: "Outlook + Teams",
    icon: "M",
  },
];

const CLIENT_LABELS = {
  default: "renaiss.io",
  sancor: "Sancor Salud",
};

export function AccountsView() {
  const [accounts, setAccounts] = useState([]);
  const [googleClients, setGoogleClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [accs, clients] = await Promise.allSettled([api.accounts(), api.googleClients()]);
      if (accs.status === "fulfilled") setAccounts(accs.value);
      if (clients.status === "fulfilled") setGoogleClients(clients.value);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function doLogin(p, client) {
    setRedirecting(`${p}:${client || ""}`);
    window.open(`/api/v1/auth/${p}/login${client ? `?client=${client}` : ""}`, "_self");
  }

  async function remove(id) {
    setDeleting(id);
    try {
      await api.removeAccount(id);
      await load();
    } finally {
      setDeleting(null);
    }
  }

  const byProvider = (p) => accounts.filter((a) => a.provider === p);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="font-semibold text-lg mb-1 text-slate-100">Cuentas vinculadas</h2>
        <p className="text-sm text-slate-500">
          Podés conectar varias cuentas de Google o Microsoft. Se sincronizan todas y se mezclan en
          una sola vista de disponibilidad e inbox.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-40" />
          <div className="skeleton h-40" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {PROVIDERS.map((p) => {
            const linked = byProvider(p.id);
            const c = providerColor(p.id);
            return (
              <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-semibold text-slate-200">
                      {p.icon}
                    </div>
                    <div>
                      <div className="font-medium text-slate-200">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.desc}</div>
                    </div>
                  </div>
                  {linked.length > 0 && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${c.bg} ${c.border} ${c.text}`}>
                      {linked.length} cuenta{linked.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  {linked.length === 0 && (
                    <div className="text-xs text-slate-600 py-1">Sin cuentas vinculadas</div>
                  )}
                  {linked.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
                    >
                      <ShieldCheck size={14} className={`shrink-0 ${c.text}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-300 truncate">{acc.provider_email}</div>
                        <div className="text-[11px] text-slate-600">
                          {acc.provider === "google"
                            ? `${CLIENT_LABELS[acc.client_name] || acc.client_name || "Google"} · ${acc.scopes.length} permisos`
                            : `${acc.scopes.length} permisos`}
                        </div>
                      </div>
                      <button
                        onClick={() => remove(acc.id)}
                        disabled={deleting === acc.id}
                        title="Desvincular"
                        className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400 transition disabled:opacity-50"
                      >
                        {deleting === acc.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  ))}
                </div>

                {p.id === "google" && googleClients.length > 1 ? (
                  <div className="space-y-1.5">
                    {googleClients
                      .filter((cl) => cl.has_credentials)
                      .map((cl) => (
                        <button
                          key={cl.name}
                          onClick={() => doLogin(p.id, cl.name)}
                          disabled={redirecting === `${p.id}:${cl.name}`}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition disabled:opacity-60"
                        >
                          <span className="flex items-center gap-2">
                            {redirecting === `${p.id}:${cl.name}` ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            Agregar {CLIENT_LABELS[cl.name] || cl.name}
                          </span>
                        </button>
                      ))}
                  </div>
                ) : (
                  <button
                    onClick={() => doLogin(p.id)}
                    disabled={redirecting === `${p.id}:`}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition disabled:opacity-60"
                  >
                    {redirecting === `${p.id}:` ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    Agregar cuenta {p.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
        <span className="font-medium text-slate-400">Nota:</span> el calendario de Outlook también se puede
        leer via <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">OUTLOOK_ICS_URL</code> sin OAuth.
        Se sincroniza automáticamente con el worker cada 15 min.
      </div>
    </div>
  );
}