# Calendar Bridge — Widget

Widget compacto para ver tu disponibilidad del día y la semana (Google + Outlook) desde el celular (Android/iOS) o desktop (Windows/Linux).

## Stack

- React 19 + Vite 6 + Tailwind 4
- **Capacitor 7** (Android + iOS)
- Funciona también como web (para desktop)

## Requisitos

- El backend corriendo (ver README principal).
- Para Android: Android Studio + SDK (para `cap run android`).
- Para iOS: macOS + Xcode (para `cap run ios`).

## Uso

### Web (desktop Windows/Linux)

```bash
npm install
npm run dev        # http://localhost:5174 (proxy /api → localhost:8000)
```

### Android

```bash
npm install
npm run build      # genera dist/
npx cap sync       # copia el build a android/
npx cap run android  # abre en un emulador/device
```

### iOS

```bash
npm run build
npx cap sync
npx cap run ios
```

### Configurar la URL de la API

- En **web dev**: dejá el campo vacío (Vite hace proxy a `localhost:8000`).
- En **app nativa**: tocá el ícono de ajustes y poné la IP de la máquina del backend, p. ej. `http://192.168.1.10:8000`. Se guarda en el dispositivo.

## Estructura

```
widget/
├── index.html
├── capacitor.config.json   # appId io.renaiss.calendarbridge
├── vite.config.js          # proxy /api → localhost:8000 (dev)
├── android/                # proyecto nativo Android (generado por cap add android)
└── src/
    ├── main.jsx
    ├── App.jsx             # layout widget: hoy + semana + settings
    ├── index.css
    ├── lib/
    │   ├── api.js          # wrapper API con base configurable en runtime
    │   └── utils.js        # fechas
    └── components/
        ├── TodayCard.jsx   # tarjeta del día con bloques ocupado/libre
        ├── WeekStrip.jsx   # mini-semana con barras de carga
        └── SettingsModal.jsx  # configurar URL de la API
```

## Funcionalidades

- **Hoy**: tarjeta con bloques de reuniones (Google vs Aunesa/Outlook) y barra ocupado/libre.
- **Semana**: mini-grid de 7 días con barras de carga (verde = libre, azul = ocupado).
- **Sincronizar**: fuerza el sync de calendarios + ICS del backend.
- **Vincular cuentas**: abre el flujo OAuth de Google/Microsoft en el navegador del sistema.
- **Config**: URL del backend configurable en runtime (para la app nativa).