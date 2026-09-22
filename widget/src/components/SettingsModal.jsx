import { useState } from "react";
import { getApiBase, setApiBase } from "../lib/api.js";

export function SettingsModal({ onClose, onSave }) {
  const [url, setUrl] = useState(getApiBase() || "http://localhost:8000");

  return (
    <div className="fixed inset-0 z-20 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Ajustes</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 transition">
            ✕
          </button>
        </div>

        <label className="block text-xs text-slate-400 mb-1">URL de la API del backend</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.1.10:8000"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:border-blue-500"
        />
        <p className="text-[11px] text-slate-500 mb-4">
          En la app nativa (Android/iOS) usá la IP de la máquina donde corre el backend. En web dev
          dejalo vacío (usa el proxy de Vite).
        </p>

        <button
          onClick={() => {
            setApiBase(url);
            onSave();
          }}
          className="w-full px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}