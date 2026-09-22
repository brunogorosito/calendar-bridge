# Calendar Bridge — Frontend

Web app para visualizar tu disponibilidad unificada (Google + Outlook) y tu inbox.

## Stack

- React 19 + Vite 6
- Tailwind CSS 4
- lucide-react (íconos)

## Requisitos

- El backend corriendo en `http://localhost:8000` (ver README principal).

## Uso

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173`. Vite hace proxy de `/api` hacia el backend, así que no hay que configurar CORS.

## Build

```bash
npm run build   # genera dist/
npm run preview # sirve el build en :5173
```

## Funcionalidades

- **Calendario**: vistas de día / semana / mes con bloques ocupado/libre.
  Cada bloque indica la fuente (Google o Aunesa/Outlook). Barra de resumen con minutos ocupados vs libres.
- **Inbox**: lista unificada de mensajes, filtro por no leídos y búsqueda por asunto/remitente.
- **Cuentas**: vinculá o reconectá Google y Microsoft, y ves el estado de cada cuenta.

## Estructura

```
frontend/
├── index.html
├── vite.config.js        # proxy /api → localhost:8000
└── src/
    ├── main.jsx
    ├── App.jsx           # layout + tabs
    ├── index.css
    ├── lib/
    │   ├── api.js        # wrapper del backend
    │   └── utils.js      # fechas, labels
    └── components/
        ├── CalendarView.jsx
        ├── InboxView.jsx
        └── AccountsView.jsx
```