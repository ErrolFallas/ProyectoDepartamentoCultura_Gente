# n8n — Automatización de ingesta

Esta carpeta contiene los workflows de n8n que orquestan la lectura del Excel
vinculado a Microsoft Forms y disparan eventos periódicos al backend.

## Reglas duras

- n8n **solo** dispara y traslada datos. No escribe en MySQL.
- n8n **nunca** llama a Gemini.
- n8n **nunca** genera presentaciones.
- Si la API falla, n8n reintenta y registra el error.

## Cómo correrlo

```powershell
# desde la raíz del repo
npx n8n
# UI: http://localhost:5678
```

## Workflows incluidos

| Workflow | Trigger | Acción |
| --- | --- | --- |
| `FormsIngest.json` | Schedule cada 40s | Descargar Excel → mapear filas → `POST /api/responses/ingest/batch` |
| `MonthlySnapshot.json` | Cron `5 1 1 * *` | Cerrar mes anterior → `POST /api/snapshots/close` |
| `AlertRefresh.json` | Cron `0 6 * * *` | Recalcular semáforo → `POST /api/alerts/recalculate` |

### Importar en n8n

1. Abrir http://localhost:5678
2. Menú → **Import from File** → seleccionar `workflows/FormsIngest.json`.
3. Conectar credencial **Microsoft OneDrive OAuth2**.
4. Confirmar que `MS_DRIVE_ITEM_ID`, `BACKEND_BASE_URL` y `N8N_INGEST_TOKEN`
   estén disponibles como variables de entorno de n8n (ver Settings → Variables).
5. Activar el workflow.

### Workflows pendientes (fases siguientes)

(ninguno; los 3 workflows del plan están entregados)
