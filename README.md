# Calendar Bridge

Backend API para unificar **Google Calendar + Gmail** y **Microsoft Outlook/Teams** en una sola vista de día / semana / mes y un inbox unificado. Pensado como backend para futuros widgets (Android, iOS, Windows, Linux) y apps web.

Unifica dos empresas que usan ecosistemas distintos (Google Workspace vs Microsoft 365) en un solo lugar.

## Características

- 🔗 **OAuth2** para Google (Calendar + Gmail) y Microsoft (Graph API: Outlook + Teams).
- 📅 Calendarios unificados con vistas de **día / semana / mes** (bloques ocupado/libre, minutos libres).
- 📬 **Inbox unificado** (Gmail + Outlook).
- 📄 Soporte de **calendario Outlook publicado (ICS)** sin OAuth para lectura rápida.
- 🔄 **Worker de sync** periódico (APScheduler, default 15 min).
- 🐳 Todo en **Docker Compose** (Postgres + API + worker).

## Arquitectura

```
calendar-bridge/
├── app/
│   ├── main.py              # FastAPI app + middleware + lifespan
│   ├── config.py            # Settings (env vars)
│   ├── database.py          # SQLAlchemy async + engine/session
│   ├── models/              # ORM: User, ProviderAccount, CalendarEvent, EmailMessage
│   ├── schemas/             # Pydantic: EventOut, DayView, WeekView, MonthView, EmailOut
│   ├── providers/           # Abstracción de proveedores
│   │   ├── base.py          #   interface común (CalendarProvider)
│   │   ├── google.py        #   Google Calendar + Gmail (OAuth2)
│   │   ├── microsoft.py     #   MS Graph: Outlook + Teams (OAuth2)
│   │   └── ics.py           #   Calendario Outlook publicado (ICS, sin OAuth)
│   ├── services/
│   │   ├── tokens.py        #   refresh de tokens + persistencia
│   │   ├── sync.py          #   sync de calendarios y emails
│   │   ├── availability.py  #   cálculo de día/semana/mes
│   │   └── inbox.py         #   inbox unificado
│   └── api/routes/          # auth, calendar, inbox
├── worker/scheduler.py      # APScheduler: sync periódico
├── docker-compose.yml       # db + api + worker
├── Dockerfile
└── .env.example
```

## Puesta en marcha

### Requisitos

- Docker + Docker Compose
- Python 3.12+ (solo para desarrollo local)

### 1. Clonar y configurar

```bash
git clone https://github.com/brunogorosito/calendar-bridge.git
cd calendar-bridge
cp .env.example .env
```

Completar `.env` con tus credenciales (ver sección siguiente).

### 2. Credenciales OAuth

#### Google (Calendar + Gmail)

1. Ir a https://console.cloud.google.com → crear proyecto.
2. **APIs & Services → Library**: habilitar **Google Calendar API** y **Gmail API**.
3. **APIs & Services → OAuth consent screen** → **External** → completar datos.
   - Agregar tu cuenta como **test user** (o publicar la app).
4. **Credentials → Create credentials → OAuth client ID** → tipo **Web application**.
   - **Authorized redirect URIs**: `http://localhost:8000/api/v1/auth/google/callback`.
5. Copiar a `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

#### Microsoft (Outlook + Teams) — opcional

1. Ir a https://portal.azure.com → **Microsoft Entra ID → App registrations → New registration**.
   - Redirect URI: tipo **Web**, `http://localhost:8000/api/v1/auth/microsoft/callback`.
2. **API permissions → Add a permission → Microsoft Graph → Delegated permissions**:
   - `offline_access`, `User.Read`, `Calendars.Read`, `Mail.Read`, `OnlineMeetings.Read`.
3. **Certificates & secrets → New client secret**.
4. Copiar a `.env`:
   ```
   MS_CLIENT_ID=...
   MS_CLIENT_SECRET=...
   MS_TENANT_ID=...   # tu Tenant ID, o "common"
   ```

#### Calendario Outlook publicado (ICS) — opcional pero recomendado

Si tenés un calendario Microsoft publicado (Outlook Web → Settings → Calendar → Shared calendars → Publish), copiá la URL `.ics`:

```
OUTLOOK_ICS_URL=https://outlook.office365.com/owa/calendar/...
```

Este modo lee el calendario de Outlook **sin OAuth**.

### 3. Levantar

```bash
docker compose up -d --build
```

Levanta:
- **Postgres** (puerto 5434 para no chocar con otros servicios)
- **API** en `http://localhost:8000`
- **Worker** de sync (cada `SYNC_INTERVAL_MINUTES`, default 15)

### 4. Vincular cuentas

Abrir en el navegador:

```
http://localhost:8000/api/v1/auth/google/login
```

→ redirige a Google → autorizás → el callback guarda los tokens.

Repetir con `/api/v1/auth/microsoft/login` (si configuraste Azure).

Si usás el ICS de Outlook, correr una vez:

```bash
curl -X POST http://localhost:8000/api/v1/auth/sync/ics
```

## Endpoints (base: `/api/v1`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/auth/{provider}/login` | Redirige a OAuth (`google` o `microsoft`) |
| GET | `/auth/{provider}/callback` | Callback OAuth (guarda tokens) |
| GET | `/auth/accounts` | Cuentas vinculadas |
| POST | `/auth/sync/ics` | Sincroniza calendario Outlook publicado (sin OAuth) |
| POST | `/auth/refresh` | Fuerza sync manual de todas las cuentas |
| GET | `/calendar/events?start=&end=` | Eventos unificados en rango |
| POST | `/calendar/events` | Crear reunión (body: account_id, summary, start, end, ...) |
| PATCH | `/calendar/events/{id}` | Editar reunión |
| DELETE | `/calendar/events/{id}` | Eliminar reunión |
| GET | `/calendar/day/{date}` | Vista de día (bloques ocupado/libre) |
| GET | `/calendar/week/{date}` | Vista de semana (lunes a domingo) |
| GET | `/calendar/month/{date}` | Vista de mes (semanas calendario) |
| GET | `/inbox?unread_only=&search=` | Inbox unificado |
| GET | `/suggest/slots?start=&end=&duration=` | Sugerencia de horarios libres |
| GET | `/stats?start=&end=` | Horas de reunión por cuenta/periodo |
| GET | `/health` | Health check |

Parámetros comunes de las vistas: `tz`, `work_start`, `work_end`.

### Ejemplos

```bash
# Disponibilidad de hoy
curl "http://localhost:8000/api/v1/calendar/day/2026-09-22?tz=America/Argentina/Buenos_Aires"

# Semana
curl "http://localhost:8000/api/v1/calendar/week/2026-09-21"

# Mes
curl "http://localhost:8000/api/v1/calendar/month/2026-09-01"

# Inbox sin leer
curl "http://localhost:8000/api/v1/inbox?unread_only=true"
```

## Desarrollo local sin Docker

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # completar credenciales
# levantar un Postgres, luego:
DATABASE_URL=postgresql+asyncpg://bridge:bridge@localhost:5434/bridge \
  .venv/bin/uvicorn app.main:app --reload
.venv/bin/python worker/scheduler.py
```

## Estado actual

- ✅ **Google** (`bruno.gorosito@renaiss.io`): Google Calendar + Gmail vinculados por OAuth.
- ✅ **Microsoft** (`bgorosito@aunesa.com`): calendario Outlook/Teams vía `OUTLOOK_ICS_URL` publicado (solo lectura).
- ✅ Vistas unificadas día/semana/mes mezclando ambas fuentes.
- ✅ Inbox unificado (Gmail; Outlook requiere credenciales de Azure).
- ⏳ Pendiente: inbox de Outlook + creación de reuniones de Teams vía Graph API.

## Roadmap

- [ ] Inbox de Outlook vía Graph API
- [ ] Crear/editar reuniones y generarlas como Teams meeting
- [ ] Autenticación de usuarios en la API (hoy es single-user)
- [ ] Frontend web / widgets para Android, iOS, Windows y Linux

## Deploy en producción

### Opción A: VM propia (Oracle Cloud Always Free)

```bash
git clone https://github.com/brunogorosito/calendar-bridge.git
cd calendar-bridge
cp .env.example .env   # completar credenciales y redirect URIs a la URL pública
docker compose up -d --build
```

### Opción B: Render + Neon + cron externo (free, sin tarjeta)

1. **Neon** (https://neon.tech) → crear proyecto → copiar la **connection string** de Postgres.
   Quedará algo como: `postgresql+asyncpg://user:pass@host/db?ssl=require`
   > IMPORTANTE: usar el scheme `postgresql+asyncpg` y agregar `?ssl=require` al final.
2. **Render** (https://render.com) → **New → Blueprint** → conectar el repo → usa `render.yaml`.
3. En el dashboard de Render, completar los **env vars** del servicio `calendar-bridge-api`:
   - `DATABASE_URL` → la de Neon (paso 1)
   - `API_KEYS` → un token que generes (protege la API)
   - `GOOGLE_REDIRECT_URI` y `MS_REDIRECT_URI` → `https://calendar-bridge-api.onrender.com/api/v1/auth/google/callback`
     y `.../auth/microsoft/callback` (reemplazar el nombre real del servicio)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_EXTRA_CLIENTS`, `MS_*`, `OUTLOOK_ICS_URL` → las mismas que usás en local
   - `SMTP_*` + `NOTIFY_EMAILS` → si querés notificaciones por email
   - `SECRET_KEY` → ya se genera automáticamente
4. **Registrar las redirect URIs nuevas** en:
   - Google Console → OAuth clients → agregar `https://.../auth/google/callback`
   - Azure → App registration → Authentication → agregar `https://.../auth/microsoft/callback`
5. **Cron externo** (https://cron-job.org, gratis) para reemplazar el worker:
   - Cada **15 min**: `POST https://calendar-bridge-api.onrender.com/api/v1/auth/sync` con header `X-API-Key: <tu key>`
   - Cada día a las **8:00**: `POST https://calendar-bridge-api.onrender.com/api/v1/auth/notify/daily` con el mismo header
6. Re-vincular las cuentas (los tokens son por dominio de redirect, así que hay que autorizar de nuevo).

> Nota: en el plan free de Render el servicio se duerme a los ~15 min sin tráfico y tarda ~30s en despertar. El cron cada 15 min lo mantiene casi siempre activo.

### Cambiar puertos

```bash
API_PORT=8080 DB_PORT=5433 docker compose up -d
```

## Seguridad

- Nunca subir `.env` (ya está en `.gitignore`).
- Los tokens de acceso se guardan cifrados en Postgres (por ahora en texto plano — mejorar con cifrado en reposo).
- La API es **single-user** por diseño; no exponerla a internet sin auth.

## Licencia

MIT