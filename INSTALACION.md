# Instalación y arranque — Garnier PulseWork

Guía paso a paso para clonar el repositorio y dejar la plataforma corriendo
en una máquina nueva. Pensado para Windows 10/11 con PowerShell, pero los
comandos son equivalentes en macOS/Linux cambiando `copy` por `cp` y la
forma de partir líneas con backtick.

---

## Tabla de contenidos

- [Requisitos previos](#requisitos-previos)
- [APIs externas (cuándo se necesitan y dónde obtenerlas)](#apis-externas-cuándo-se-necesitan-y-dónde-obtenerlas)
- [Paso 1 — Clonar el repositorio](#paso-1--clonar-el-repositorio)
- [Paso 2 — Instalar dependencias](#paso-2--instalar-dependencias)
- [Paso 3 — Crear y llenar el archivo `.env`](#paso-3--crear-y-llenar-el-archivo-env)
- [Paso 4 — Verificar MySQL](#paso-4--verificar-mysql)
- [Paso 5 — Migrar la base de datos](#paso-5--migrar-la-base-de-datos)
- [Paso 6 — Cargar datos base (seed)](#paso-6--cargar-datos-base-seed)
- [Paso 7 — Importar el banco de preguntas](#paso-7--importar-el-banco-de-preguntas)
- [Paso 8 — (Opcional) Sembrar respuestas demo](#paso-8--opcional-sembrar-respuestas-demo)
- [Paso 9 — Arrancar el backend](#paso-9--arrancar-el-backend)
- [Paso 10 — Arrancar el frontend](#paso-10--arrancar-el-frontend)
- [Paso 11 — (Opcional) Configurar n8n](#paso-11--opcional-configurar-n8n)
- [Credenciales iniciales para iniciar sesión](#credenciales-iniciales-para-iniciar-sesión)
- [Cómo verificar que todo funciona](#cómo-verificar-que-todo-funciona)
- [Solución de problemas comunes](#solución-de-problemas-comunes)

---

## Requisitos previos

| Componente | Versión mínima | Por qué |
| --- | --- | --- |
| **Node.js** | 20.x LTS o superior | Backend (Express) y frontend (Vite) |
| **npm** | viene con Node | Gestor de paquetes |
| **MySQL Server** | 8.0+ nativo | Almacenamiento principal |
| **Git** | cualquiera reciente | Clonar y versionar |
| **MySQL Workbench** *(recomendado)* | última | Inspeccionar tablas, no es obligatorio |

### Descargas oficiales

- Node.js LTS → <https://nodejs.org/es/download>
- MySQL Community Server → <https://dev.mysql.com/downloads/mysql/>
- MySQL Workbench → <https://dev.mysql.com/downloads/workbench/>
- Git para Windows → <https://git-scm.com/download/win>

### Comprobación rápida

```powershell
node --version    # debe imprimir v20.x.x o mayor
npm --version
mysql --version   # opcional, confirma que el cliente está en PATH
git --version
```

---

## APIs externas (cuándo se necesitan y dónde obtenerlas)

El sistema funciona **sin claves externas** gracias a un stub heurístico
incluido. Si querés capacidades completas, conseguí las siguientes:

### Gemini (Google AI) — *opcional pero recomendado*

Usada para: clasificar polaridad de preguntas nuevas y analizar el tono de
respuestas de texto abierto.

- **Dónde obtenerla:** Google AI Studio → <https://aistudio.google.com/app/apikey>
- **Tier gratuito:** sí, suficiente para esta carga
- **Variable en `.env`:** `GEMINI_API_KEY=`
- **Modelo configurable:** `GEMINI_MODEL=gemini-1.5-flash` (o `gemini-2.5-flash` si tu cuenta lo soporta — la misma key funciona)

> Si dejás `GEMINI_API_KEY` vacío, el backend usa un mock que clasifica
> correctamente los casos del Plan Maestro. Útil para evaluar la plataforma
> sin consumir cuota.

### Microsoft 365 — *opcional, solo para producción real*

Usada para: leer las respuestas del Excel vinculado a Microsoft Forms.

- **Dónde se registra una app:** Azure Portal → App registrations
  → <https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps>
- **Documentación:** <https://learn.microsoft.com/en-us/graph/auth-register-app-v2>
- **Variables en `.env`:** `MS_CLIENT_ID`, `MS_CLIENT_SECRET`,
  `MS_TENANT_ID`, `MS_DRIVE_ITEM_ID` (ID del Excel vinculado a Forms)

> En desarrollo no es necesario. Podés probar la ingesta usando `curl` o
> Postman contra `POST /api/responses/ingest` con el token de ingesta.

---

## Paso 1 — Clonar el repositorio

```powershell
cd C:\Users\<tu_usuario>\Desktop
git clone <url-del-repositorio> proyecto_Departamento_Cultura_Gente
cd proyecto_Departamento_Cultura_Gente
```

Si lo descargás como `.zip`, simplemente descomprimí y entrá a la carpeta.

---

## Paso 2 — Instalar dependencias

Desde la raíz del proyecto (ahí vive el `package.json` principal con
workspaces):

```powershell
npm install --workspaces
```

Eso instala backend y frontend en una sola pasada. Toma 1–3 minutos en la
primera ejecución.

---

## Paso 3 — Crear y llenar el archivo `.env`

```powershell
copy .env.example .env
notepad .env
```

El archivo `.env` debe quedar en **la raíz del proyecto** (al mismo nivel
que `package.json` y `README.md`). No lo pongas dentro de `backend/`.

### Lo único obligatorio

- `DB_PASSWORD` → la contraseña de tu MySQL local.

### Lo recomendado

- `GEMINI_API_KEY` → pegá la clave de Google AI Studio si la tenés.
- `GEMINI_MODEL` → dejá `gemini-1.5-flash` (default) o cambialo a un modelo
  que tu cuenta soporte.

### Lo que ya viene listo para desarrollo

- `JWT_SECRET` y `N8N_INGEST_TOKEN` traen valores `dev-only-...` que
  funcionan localmente. **Regenerá ambos antes de producción** — el
  backend aborta el arranque si detecta esos placeholders con
  `NODE_ENV=production`.

> Importante: `.env` está en `.gitignore`. Nunca lo subas a git. Para
> generar secretos fuertes podés correr:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

---

## Paso 4 — Verificar MySQL

Asegurate de que el servicio esté arriba:

```powershell
# Iniciar el servicio si está detenido (nombre típico: MySQL80 o MySQL84)
net start MySQL80
```

Si abrís Workbench, deberías conectar con el usuario y contraseña que
pusiste en `DB_USER`/`DB_PASSWORD` del `.env`. **No hace falta crear la
base de datos a mano**: el siguiente paso la crea.

---

## Paso 5 — Migrar la base de datos

```powershell
npm run migrate
```

Lo que hace internamente:

1. Conecta a MySQL con las credenciales del `.env`.
2. `CREATE DATABASE IF NOT EXISTS garnier_pulsework` con charset utf8mb4.
3. Crea la tabla `_migrations` para llevar control de qué SQL se aplicó.
4. Aplica `db/migrations/001_init_schema.sql` → 14 tablas con FKs e índices.
5. Registra el archivo para no reaplicarlo en corridas futuras.

Si más adelante se agrega `db/migrations/002_*.sql`, basta volver a correr
`npm run migrate` y se aplicará solo lo nuevo.

---

## Paso 6 — Cargar datos base (seed)

```powershell
npm run seed
```

Inserta de forma idempotente:

- 16 dimensiones (Liderazgo, Orgullo, Motivación, Demográfica, etc.).
- 8 escalas estándar (Likert acuerdo, Frecuencia, Comprensión, Nivel,
  Binaria Sí/No, Numérica 1-10, Abierta, Demográfica).
- Un `survey_run` activo `clima-2024`.
- Dos usuarios bootstrap (ver [Credenciales iniciales](#credenciales-iniciales-para-iniciar-sesión)).

---

## Paso 7 — Importar el banco de preguntas

```powershell
npm --workspace backend run seed:catalog
```

Por defecto lee:
`C:/Users/Estudiantes/Desktop/semana 17/materiales de departamento_cultura y gente/Encuesta Clima 2024.xlsx`,
hoja `PROPUESTA 2024`. Si tu archivo está en otra ruta, pasala como
argumento:

```powershell
node backend/scripts/import-catalog.js "C:\ruta\al\Encuesta.xlsx" "PROPUESTA 2024"
```

Detecta automáticamente dimensión, subdimensión, escala y polaridad
(directa / inversa / neutra) para cada pregunta del instrumento.

---

## Paso 8 — (Opcional) Sembrar respuestas demo

Si querés que los paneles muestren datos antes de conectar Forms real:

```powershell
npm --workspace backend run seed:demo
```

Genera ~300 respuestas anónimas variadas a lo largo de los últimos 4 meses,
con perfiles intencionales para que se vea evolución, cronicidad y
contraste entre departamentos. Ver `backend/scripts/seed-respuestas-demo.js`
para personalizar.

Después del seed demo, recalculá el semáforo:

```powershell
curl -X POST http://localhost:3000/api/alerts/recalculate `
  -H "Content-Type: application/json" `
  -H "X-Ingest-Token: dev-only-ingest-token-cambiar-en-produccion-32" `
  -d "{\"periodo\":\"2026-05\"}"
```

---

## Paso 9 — Arrancar el backend

En una terminal dedicada:

```powershell
npm run dev:backend
```

Confirmación: <http://localhost:3000/api/health> debe devolver
`{ "status": "ok", "db": "up" }`.

---

## Paso 10 — Arrancar el frontend

En **otra** terminal (mantén el backend corriendo):

```powershell
npm run dev:frontend
```

Abrí <http://localhost:5173> en tu navegador. El SPA hace proxy
automático de `/api` al backend, así que CORS no debe darte problemas en
local.

---

## Paso 11 — (Opcional) Configurar n8n

n8n se ejecuta sin instalación global usando `npx`:

```powershell
npm run n8n
```

Abrí <http://localhost:5678>. Importá los workflows desde la carpeta
`n8n/workflows/`:

| Archivo | Trigger | Acción |
| --- | --- | --- |
| `FormsIngest.json` | Cada 40 s | Lee Excel de Microsoft Forms y lo POSTea al backend |
| `MonthlySnapshot.json` | Cron `5 1 1 * *` | Cierra el snapshot del mes anterior |
| `AlertRefresh.json` | Cron `0 6 * * *` | Recalcula el semáforo |

**Para que los workflows lean tus variables**, en la UI de n8n: Settings
→ Variables, y agregá `BACKEND_BASE_URL` (`http://localhost:3000`),
`N8N_INGEST_TOKEN` (el de tu `.env`) y `MS_DRIVE_ITEM_ID` (si conectaste M365).

`FormsIngest.json` requiere además que crees una credencial OAuth2 de
Microsoft OneDrive en n8n (Settings → Credentials → New) usando los
mismos `MS_CLIENT_ID`/`MS_CLIENT_SECRET`/`MS_TENANT_ID` del `.env`.

---

## Credenciales iniciales para iniciar sesión

Creadas por `npm run seed`. Cambialas tras el primer login.

| Email | Contraseña | Rol |
| --- | --- | --- |
| `admin@pulsework.local` | `PulseWork#2024` | ADMIN |
| `analista@pulsework.local` | `Analista#2024` | ANALISTA |

---

## Cómo verificar que todo funciona

Tras completar los pasos 1–10:

1. **Backend en pie:** <http://localhost:3000/api/health> retorna JSON con `status: ok`.
2. **Login funciona:** abrí <http://localhost:5173>, entrá con `admin@pulsework.local`.
3. **Catálogo con preguntas:** menú lateral → Catálogo, deberías ver la
   bandeja vacía (si las preguntas se importaron como `CONFIRMADA`) o
   un listado de pendientes (si quedaron en `PENDIENTE_REVISION`).
4. **Si corriste seed:demo + recalcular alertas:** Asistente debe mostrar
   focos rojos y amarillos, Semáforo lista departamentos, Comparador
   permite seleccionar empresas.

---

## Solución de problemas comunes

**`Access denied for user 'root'@'localhost'`**
Revisá `DB_USER` y `DB_PASSWORD` en `.env`. Si recién instalaste MySQL,
el password de `root` se definió durante la instalación. Probá conectar
desde Workbench primero para confirmar credenciales.

**`ECONNREFUSED 127.0.0.1:3306`**
MySQL no está corriendo. `net start MySQL80` (o el nombre que tenga tu
servicio en `services.msc`).

**`Configuración inválida: JWT_SECRET — debe tener al menos 16 caracteres`**
El `.env` no se está leyendo o está vacío. Verificá que el archivo se
llame exactamente `.env` (no `.env.txt`) y esté en la **raíz** del proyecto.

**`Error: Cannot find module 'express'`**
No corriste `npm install --workspaces` desde la raíz. Volvé al Paso 2.

**El frontend abre pero no carga datos**
Confirmá que el backend está en `localhost:3000` (no en otro puerto). Si
cambiaste el puerto, ajustá `vite.config.js → proxy` o seteá
`VITE_BACKEND_URL` en `frontend/.env`.

**No hay preguntas en el Catálogo después de `seed:catalog`**
Verificá la ruta del Excel. El script imprime cuántas preguntas creó vs
existentes. Si imprime `creadas: 0, existentes: 0`, no encontró
encabezados — revisá que la hoja se llame `PROPUESTA 2024` o pasá el
nombre como segundo argumento.

**`Configuración inválida` aunque el `.env` esté lleno**
Si el archivo se guardó con BOM (Notepad de Windows a veces lo hace),
algunas variables pueden quedar invisibles. Reabrilo con VSCode y
guardalo como UTF-8 sin BOM.
