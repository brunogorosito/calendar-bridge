import { useEffect, useMemo, useState } from "react";
import { Mail, MailOpen, Paperclip, Search } from "lucide-react";
import { api } from "../lib/api.js";
import {
  avatarColor,
  initials,
  providerLabel,
  providerColor,
  timeAgo,
} from "../lib/utils.js";

export function InboxView() {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .inbox(100, unreadOnly, search)
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

  const providers = useMemo(() => [...new Set(mails.map((m) => m.provider))], [mails]);

  const visible = useMemo(() => {
    if (providerFilter === "all") return mails;
    return mails.filter((m) => m.provider === providerFilter);
  }, [mails, providerFilter]);

  const unreadCount = useMemo(() => mails.filter((m) => !m.is_read).length, [mails]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-56">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por asunto o remitente…"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-slate-600 transition"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="accent-slate-400 w-4 h-4"
            />
            Solo sin leer
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-200 text-[10px] font-medium">
                {unreadCount}
              </span>
            )}
          </label>
        </div>

        {providers.length > 1 && (
          <div className="flex gap-1.5">
            <button
              onClick={() => setProviderFilter("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                providerFilter === "all" ? "bg-slate-700 text-slate-100" : "bg-slate-800/60 text-slate-500 hover:text-slate-300"
              }`}
            >
              Todos
            </button>
            {providers.map((p) => {
              const count = mails.filter((m) => m.provider === p).length;
              return (
                <button
                  key={p}
                  onClick={() => setProviderFilter(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    providerFilter === p ? "bg-slate-700 text-slate-100" : "bg-slate-800/60 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {providerLabel(p)} · {count}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
          Error: {error}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-600">
          <div className="w-16 h-16 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-center">
            <Mail size={28} className="opacity-60" />
          </div>
          <div className="text-sm">{unreadOnly ? "No hay mensajes sin leer" : "Sin mensajes"}</div>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          {visible.map((m) => {
            const sender = m.from_name || m.from_email;
            const c = providerColor(m.provider);
            return (
              <div
                key={`${m.provider}-${m.id}`}
                className={`flex items-start gap-3 p-4 transition hover:bg-slate-800/30 ${
                  !m.is_read ? "bg-slate-800/20" : ""
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full ${avatarColor(m.from_email)} flex items-center justify-center text-white text-xs font-bold shrink-0`}
                >
                  {initials(sender)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    {!m.is_read ? <Mail size={13} className="text-sky-400 shrink-0" /> : <MailOpen size={13} className="text-slate-500 shrink-0" />}
                    <span className="text-xs font-medium text-slate-300 truncate">{sender}</span>
                    <span className={`ml-auto shrink-0 text-[11px] ${!m.is_read ? "text-slate-200 font-medium" : "text-slate-500"}`}>
                      {timeAgo(m.received_at)}
                    </span>
                  </div>
                  <div className={`text-sm truncate ${m.is_read ? "text-slate-200" : "font-semibold text-white"}`}>
                    {m.subject || "(sin asunto)"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{m.body_preview}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${c.bg} ${c.border} ${c.text}`}>
                      {providerLabel(m.provider)}
                    </span>
                    {m.has_attachments && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Paperclip size={11} /> adjunto
                      </span>
                    )}
                    {m.to.length > 0 && (
                      <span className="text-[10px] text-slate-600 truncate">para {m.to.join(", ")}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}