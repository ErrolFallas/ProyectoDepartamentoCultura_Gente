# Garnier PulseWork

Plataforma de Bienestar y Clima Organizacional para el **Departamento de
Cultura y Gente**. Procesa respuestas anónimas de Microsoft Forms, puntúa
emociones, compara empresas y departamentos, opera un semáforo de alertas y
genera presentaciones `.pptx` editables.

> Este monorepo implementa las **Fases 1–6** del Plan Maestro v1.0:
> **Cimientos**, **Ingesta**, **Scoring**, **Agregación**, **Paneles** y
> **Generador `.pptx`**.

## ¿Acabás de clonar? Empezá por acá

- 📖 **[INSTALACION.md](./INSTALACION.md)** — Pasos completos: requisitos,
  cómo conseguir las APIs (Gemini, Microsoft 365), `.env`, MySQL, migración,
  seed, comandos de backend/frontend, configuración de n8n y solución de
  problemas comunes.
- 🧭 **[FUNCIONALIDADES.md](./FUNCIONALIDADES.md)** — Qué hace cada uno de
  los 6 paneles, qué preguntas responde, qué endpoints consume y el
  potencial a futuro por sección.

## Reglas innegociables

1. **Anonimato estricto.** El sistema nunca identifica a la persona; solo
   empresa + departamento. Departamentos con menos de
   `MIN_RESPUESTAS_DEPARTAMENTO` (5 por defecto) **no se exponen aislados**.
2. **Polaridad humana.** La IA sugiere; RRHH confirma. Mientras una
   pregunta no esté `CONFIRMADA`, sus respuestas quedan `EN_ESPERA` y no
   contaminan el semáforo.
3. **Separación de responsabilidades.** n8n solo ingiere. Nunca escribe en
   MySQL, nunca llama a la IA, nunca genera presentaciones.
4. **Tecnología fija.** Node.js + Express + MySQL nativo + React. Sin PHP,
   sin Docker, sin phpMyAdmin. La IA es Gemini (Google AI Studio).

## Stack

| Capa | Tecnología |
| --- | --- |
| Backend | Node.js 20 + Express + mysql2 |
| BD | MySQL nativo (Windows) + Workbench |
| Auth | JWT |
| IA | Gemini (Google AI Studio) con stub local si no hay clave |
| Ingesta | n8n vía `npx`, sin Docker |
| Frontend | React 18 + Vite + Tailwind + Recharts |
| Salida | PptxGenJS (`.pptx` editable) |

## Estructura

```
proyecto_Departamento_Cultura_Gente/
├── backend/        # API Node.js (29 endpoints)
├── frontend/       # SPA React (6 paneles)
├── db/migrations/  # Schema SQL (14 tablas)
├── n8n/workflows/  # 3 workflows exportables
└── .env.example    # Variables de entorno
```

## Setup local

### 1. Requisitos

- **Node.js ≥ 20** (`node --version`)
- **MySQL Server 8** instalado nativamente (Windows)
- **MySQL Workbench** (administración)
- Permisos para crear bases de datos y usuarios

### 2. Variables de entorno

```powershell
Copy-Item .env.example .env
notepad .env
```

Completar como mínimo:

- `DB_PASSWORD`
- `JWT_SECRET` (≥ 16 caracteres aleatorios)
- `N8N_INGEST_TOKEN` (≥ 16 caracteres aleatorios)

`GEMINI_API_KEY` y credenciales Microsoft 365 son **opcionales** en local:
sin clave, Gemini se reemplaza por un mock heurístico y la ingesta lee filas
desde el endpoint manualmente.

### 3. Instalar dependencias

```powershell
npm install --workspaces
```

### 4. Crear schema + datos base

```powershell
npm run migrate     # crea la BD, aplica db/migrations/*.sql
npm run seed        # dimensiones, escalas, survey_run, admin
```

> El seed crea un usuario admin de bootstrap:
> `admin@pulsework.local` / `PulseWork#2024`. **Cambiar tras el primer login.**

### 5. Importar el banco de preguntas existente

```powershell
npm --workspace backend run seed:catalog
# o con ruta/hoja custom:
node backend/scripts/import-catalog.js "C:\ruta\al.xlsx" "PROPUESTA 2024"
```

El importador detecta dimensión, subdimensión y escala automáticamente a
partir del Excel `Encuesta Clima 2024.xlsx`. La polaridad inicial se infiere
heurísticamente; las preguntas quedan como `CONFIRMADA` porque son el
catálogo de referencia. Cualquier pregunta NUEVA que entre por Forms quedará
`PENDIENTE_REVISION` hasta que RRHH la confirme.

### 6. Levantar el backend

```powershell
npm run dev:backend
# http://localhost:3000/api/health
```

### 7. Levantar el frontend (SPA)

```powershell
npm run dev:frontend
# http://localhost:5173  · proxy /api → backend
```

### 8. Activar la ingesta n8n

```powershell
npm run n8n
# UI: http://localhost:5678
```

Importar `n8n/workflows/FormsIngest.json` y configurar credenciales
Microsoft OneDrive. Ver `n8n/README.md`.

## API

### Fase 1–3

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET  | `/api/health` | público | Estado del backend + ping MySQL |
| POST | `/api/auth/login` | público | Login RRHH (devuelve JWT) |
| GET  | `/api/auth/me` | JWT | Datos del usuario actual |
| POST | `/api/responses/ingest` | `X-Ingest-Token` | Ingestar 1 fila de Forms |
| POST | `/api/responses/ingest/batch` | `X-Ingest-Token` | Ingestar lote de filas |
| GET  | `/api/catalog/dimensions` | JWT | Listar dimensiones |
| GET  | `/api/catalog/scales` | JWT | Listar escalas |
| GET  | `/api/catalog/questions/pending` | JWT | Preguntas `PENDIENTE_REVISION` |
| GET  | `/api/classifications` | JWT | Sugerencias de IA pendientes |
| POST | `/api/classifications/:id/confirm` | JWT | Confirmar / corregir / rechazar polaridad |

### Fase 4 — Agregación, snapshots, rankings y semáforo

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET  | `/api/aggregates/scope?scope&scope_id&periodo` | JWT | %pos/%neg/%neutro + promedio para empresa o depto |
| GET  | `/api/aggregates/question?...&question_id` | JWT | Agregado a nivel pregunta |
| GET  | `/api/aggregates/question/distribution?...` | JWT | Distribución de opciones (para `.pptx`) |
| GET  | `/api/aggregates/compare?scope&scope_ids=1,2,3&periodo` | JWT | Comparador (hasta 3) |
| POST | `/api/snapshots/close` | ADMIN / ingest | Cerrar mes (inmutable) |
| GET  | `/api/snapshots?periodo&scope` | JWT | Listar snapshots de un periodo |
| GET  | `/api/snapshots/history?scope&scope_id&lookback_months` | JWT | Histórico mensual (Tendencias) |
| GET  | `/api/rankings?tipo&scope&periodo[&question_id\|&dimension_id]` | JWT | Top-20 con caché |
| POST | `/api/rankings/recompute?...` | JWT | Forzar recálculo |
| GET  | `/api/alerts?periodo&nivel&atendida` | JWT | Listar alertas |
| GET  | `/api/alerts/focos?periodo` | JWT | Resumen para Asistente de notificaciones |
| POST | `/api/alerts/recalculate` | JWT / ingest | Recalcular semáforo |
| POST | `/api/alerts/:id/atender` | JWT | Marcar alerta como atendida |
| GET  | `/api/temporal/day-of-week?scope&scope_id&periodo` | JWT | Distribución por día (lunes blues) |
| GET  | `/api/temporal/cronicidad?scope&scope_id&lookback_months` | JWT | Meses consecutivos en alerta |

### Ejemplo: ingesta manual

```bash
curl -X POST http://localhost:3000/api/responses/ingest \
  -H "Content-Type: application/json" \
  -H "X-Ingest-Token: $N8N_INGEST_TOKEN" \
  -d '{
    "submitted_at": "2024-08-12T09:30:00Z",
    "company": "GGDI",
    "department": "Operaciones",
    "answers": [
      { "question": "Estoy orgulloso de trabajar aquí", "value": "Totalmente de acuerdo" },
      { "question": "¿He pensado en abandonar la empresa por estrés?", "value": "Rara vez" }
    ]
  }'
```

Si el `source_row_hash` ya existe en `responses`, la API responde
`{ status: "DUPLICADO" }` sin reprocesar la fila.

## Arquitectura del backend

```
src/
├── config/        # env validada (zod) y logger pino
├── db/            # pool mysql2 + helper withTransaction
├── middleware/    # auth JWT, auth ingesta, validate, errores
├── routes/        # cableado de endpoints
├── controllers/   # adaptadores HTTP (sin lógica)
├── services/      # lógica de negocio (scoring, gemini, ingest...)
├── repositories/  # acceso a MySQL (sin lógica)
├── validators/    # esquemas zod por endpoint
└── utils/         # hash SHA256, normalización, errores
```

## Motor de scoring (Fase 3)

- Cada respuesta se normaliza a **0–100** según la escala de la pregunta.
- Si la polaridad es **INVERSA**, se aplica `100 − valor` antes de clasificar.
- Si la polaridad es **NEUTRA** (demográficas), la respuesta no puntúa.
- Si la pregunta está en `PENDIENTE_REVISION`, la answer queda `EN_ESPERA`.
- Cuando RRHH confirma la polaridad, se procesan retroactivamente todas
  las answers `EN_ESPERA` de esa pregunta (transacción única).
- Los umbrales `UMBRAL_NEGATIVO_MAX` / `UMBRAL_NEUTRO_MAX` clasifican cada
  respuesta como `NEGATIVO`, `NEUTRO` o `POSITIVO`.

## Reglas de Fase 4

- **Snapshots inmutables.** `monthly_snapshots` usa `INSERT IGNORE` con un
  `UNIQUE (periodo, scope, scope_id, question_id)`: una vez cerrado el mes
  no se reescribe, incluso si llegan respuestas tardías. Esto preserva
  comparativas año-contra-año confiables.
- **Caché de rankings.** Antes de calcular, el servicio compara
  `calculado_at` del último item contra `MAX(responses.created_at)` del
  período. Si el caché es posterior, se devuelve sin recalcular.
- **Semáforo configurable.** Umbrales en `.env`
  (`SEMAFORO_AMARILLO_MIN`, `SEMAFORO_ROJO_MIN`). Por defecto: VERDE < 40,
  AMARILLO ≥ 40, ROJO ≥ 75 (% negativo).
- **Anonimato.** Snapshots y rankings de DEPARTAMENTO con
  `n_respuestas < MIN_RESPUESTAS_DEPARTAMENTO` se excluyen del ranking;
  para alertas, sencillamente no se genera la fila (no se expone).

## Frontend (Fase 5)

SPA en **React 18 + Vite + Tailwind + Recharts**, organizada en 6 paneles
según el Plan Maestro. Comparte tokens visuales corporativos (`brand`,
`semaforo`) y respeta la regla de anonimato en toda vista.

| Panel | Ruta | Endpoints consumidos |
| --- | --- | --- |
| Asistente (focos del día) | `/` | `GET /alerts/focos` |
| Comparador | `/comparador` | `GET /aggregates/compare`, `GET /rankings` |
| Semáforo | `/semaforo` | `GET /alerts`, `POST /alerts/recalculate`, `POST /alerts/:id/atender` |
| Tendencias | `/tendencias` | `GET /snapshots/history`, `GET /temporal/day-of-week`, `GET /temporal/cronicidad` |
| Catálogo (revisión) | `/catalogo` | `GET /classifications`, `POST /classifications/:id/confirm` |
| Presentación (Fase 6) | `/presentacion` | `GET /presentation/preview`, `POST /presentation/generate` |

Login: `POST /auth/login`. La sesión se persiste en `localStorage` y se
restaura automáticamente al recargar. `ProtectedRoute` redirige a `/login`
si el token expiró.

### Estructura del frontend

```
frontend/src/
├── main.jsx, App.jsx, index.css
├── lib/          api.js (fetch wrapper + JWT) + format.js
├── context/      AuthContext (login/logout/restore)
├── hooks/        useApi (loading/error/reload)
├── routes/       ProtectedRoute
├── components/
│   ├── layout/   Sidebar, Topbar, Layout
│   ├── common/   Card, PageHeader, Spinner, EmptyState, StatBadge,
│   │             PeriodPicker, ScopeSelector, NivelPill, ErrorBox
│   └── charts/   SentimentBars, TrendLine, DayBars (Recharts)
└── pages/        Login, Dashboard, Comparator, Alerts, Trends,
                  Catalog, Presentation
```

### CORS

El backend acepta cualquier `http://localhost:PORT` y
`http://127.0.0.1:PORT` para desarrollo. Headers expuestos:
`Authorization`, `X-Ingest-Token`. En producción ajustar la lista blanca
o servir el SPA con same-origin detrás de un proxy.

## Fase 6 — Generador `.pptx`

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET  | `/api/presentation/preview?scope&scope_id&periodo` | JWT | Devuelve cuántos bloques incluiría el informe (sin generarlo) |
| POST | `/api/presentation/generate` | JWT | Construye y descarga el `.pptx` editable |

El `.pptx` incluye: portada con tipo de entidad explícito, encuestas
aplicadas, resumen ejecutivo con KPIs y semáforo, una o más láminas con
tabla por dimensión, mejores resultados, áreas de mejora, y temas
detectados por la IA en texto abierto. El archivo es editable: RRHH puede
ajustar branding, ocultar contenido sensible o agregar notas antes de
presentar.

## Documentación de referencia

- `Plan_Maestro_PulseWork_v1.0.docx` (entregado por RRHH)
- `materiales de departamento_cultura y gente/Encuesta Clima 2024.xlsx`
- `materiales de departamento_cultura y gente/Clima Organizacional Avon.pptx.pdf`
