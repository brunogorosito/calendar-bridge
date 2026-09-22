import { useEffect, useState } from "react";
import { Mail, Search } from "lucide-react";
import { api } from "../lib/api.js";
import { providerLabel, providerColor } from "../lib/utils.js";

export function InboxView() {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .inbox(50, unreadOnly, search)
      .then((data) => {
        if (!cancelled) setMails(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unreadOnly, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-56">
          <Search size={16} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por asunto o remitente…"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="accent-blue-500"
          />
          Solo sin leer
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
          Error: {error}
        </div>
      )}
      {loading && <div className="text-slate-400 text-sm py-10 text-center">Cargando…</div>}
      {!loading && mails.length === 0 && (
        <div className="text-slate-500 text-sm py-10 text-center flex flex-col items-center gap-2">
          <Mail size={28} className="opacity-50" />
          Sin mensajes
        </div>
      )}
      {!loading &&
        mails.length > 0 && (
          <div className="divide-y divide-slate-800/60 rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            {mails.map((m) => (
              <div key={`${m.provider}-${m.id}`} className={`p-4 ${m.is_read ? "" : "bg-slate-800/20"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {!m.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                      <span className="font-medium truncate">{m.subject || "(sin asunto)"}</span>
                    </div>
                    <div className="text-sm text-slate-400 truncate">
                      {m.from_name || m.from_email} → {m.to.join(", ")}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 line-clamp-2">{m.body_preview}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${providerColor(m.provider)}`}>
                      {providerLabel(m.provider)}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(m.received_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}