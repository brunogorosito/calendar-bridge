import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Mail, ShieldCheck, ShieldOff } from "lucide-react";
import { api } from "../lib/api.js";
import { providerColor, providerLabel } from "../lib/utils.js";

const PROVIDERS = [
  {
    id: "google",
    name: "Google",
    desc: "Calendar + Gmail",
    gradient: "from-blue-500 to-cyan-500",
    icon: "G",
  },
  {
    id: "microsoft",
    name: "Microsoft",
    desc: "Outlook + Teams",
    gradient: "from-purple-500 to-fuchsia-500",
    icon: "M",
  },
];

export function AccountsView() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(null);

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

  function doLogin(p) {
    setRedirecting(p);
    window.open(`/api/v1/auth/${p}/login`, "_self");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
        <h2 className="font-bold text-lg mb-1">Cuentas vinculadas</h2>
        <p className="text-sm text-slate-400">
          Conectá tus cuentas de Google y Microsoft. Al vincular se abren los permisos de lectura de
          calendario y email.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-44" />
          <div className="skeleton h-44" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {PROVIDERS.map((p) => {
            const acc = linked(p.id);
            const c = providerColor(p.id);
            return (
              <div key={p.id} className="rounded-2xl border border-white/5 bg-slate-900/40 p-5 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white font-bold shadow-lg`}>
                      {p.icon}
                    </div>
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.desc}</div>
                    </div>
                  </div>
                  {acc && (
                    <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${c.bg} ${c.border} ${c.text}`}>
                      <ShieldCheck size={11} /> Conectado
                    </span>
                  )}
                </div>

                {acc ? (
                  <>
                    <div className="text-sm text-slate-200 truncate mb-1">{acc.provider_email}</div>
                    <div className="text-[11px] text-slate-500 mb-4">
                      {acc.scopes.length} permisos · {providerLabel(p.id)}
                    </div>
                    <button
                      onClick={() => doLogin(p.id)}
                      disabled={redirecting === p.id}
                      className="mt-auto flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-white/5 text-xs font-medium transition disabled:opacity-50"
                    >
                      {redirecting === p.id ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                      Reconectar
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-4">
                      <ShieldOff size={13} /> No vinculada
                    </div>
                    <button
                      onClick={() => doLogin(p.id)}
                      disabled={redirecting === p.id}
                      className="mt-auto flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:brightness-110 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60"
                    >
                      {redirecting === p.id ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                      Vincular {p.name}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-sm text-slate-400">
        <span className="font-medium text-slate-300">Nota:</span> el calendario de Outlook también se puede
        leer via <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">OUTLOOK_ICS_URL</code> sin OAuth.
        Se sincroniza automáticamente con el worker cada 15 min.
      </div>
    </div>
  );
}