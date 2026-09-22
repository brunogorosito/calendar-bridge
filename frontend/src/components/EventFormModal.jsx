import { useEffect, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { api } from "../lib/api.js";
import { providerLabel } from "../lib/utils.js";

const CLIENT_LABELS = { default: "renaiss.io", sancor: "Sancor Salud" };

export function EventFormModal({ initialStart, accounts, onClose, onSaved }) {
  const [summary, setSummary] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(initialStart ? initialStart.slice(0, 10) : "");
  const [startTime, setStartTime] = useState(initialStart ? initialStart.slice(11, 16) : "10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (accounts.length && !accountId) setAccountId(String(accounts[0].id));
    if (initialStart && !date) setDate(initialStart.slice(0, 10));
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accounts, accountId, initialStart, date, onClose]);

  async function submit() {
    if (!summary.trim() || !accountId || !date) {
      setError("Completá título, cuenta y fecha");
      return;
    }
    if (endTime <= startTime) {
      setError("La hora de fin debe ser posterior al inicio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createEvent({
        account_id: Number(accountId),
        summary: summary.trim(),
        start: `${date}T${startTime}:00`,
        end: `${date}T${endTime}:00`,
        description,
        location,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl animate-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-100 flex items-center gap-2">
            <CalendarPlus size={17} className="text-slate-400" /> Nueva reunión
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-800 transition">
            <X size={17} className="text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Título *</label>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ej: Reunión semanal"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Cuenta *</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
            >
              {accounts
                .filter((a) => a.provider !== "microsoft_ics")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {providerLabel(a.provider, a.client_name)} · {a.provider_email}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Inicio</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Fin</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Ubicación / link</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Oficina, Meet, Teams…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Agenda, notas…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500 resize-none"
            />
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Crear"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}