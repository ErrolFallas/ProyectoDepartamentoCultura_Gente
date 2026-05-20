# Funcionalidades y potencial — Garnier PulseWork

Guía conceptual: qué hace cada sección de la aplicación, qué tipo de
preguntas responde, y qué se puede construir encima.

---

## Tabla de contenidos

- [Visión general](#visión-general)
- [Flujo de datos completo](#flujo-de-datos-completo)
- [Reglas innegociables aplicadas en cada panel](#reglas-innegociables-aplicadas-en-cada-panel)
- [Los 6 paneles](#los-6-paneles)
  - [1. Asistente (Dashboard)](#1-asistente-dashboard)
  - [2. Comparador](#2-comparador)
  - [3. Semáforo de alertas](#3-semáforo-de-alertas)
  - [4. Tendencias e histórico](#4-tendencias-e-histórico)
  - [5. Catálogo de preguntas](#5-catálogo-de-preguntas)
  - [6. Generador de presentación](#6-generador-de-presentación)
- [Roles de usuario](#roles-de-usuario)
- [Potencial a futuro](#potencial-a-futuro)

---

## Visión general

PulseWork es una **plataforma de bienestar y clima organizacional** que
convierte respuestas anónimas de encuestas en decisiones accionables:
detectar dónde el personal tiene dificultad para sentirse bien, priorizar
visitas de Cultura y Gente, y demostrar evolución mes a mes.

Tres ideas clave del producto:

1. **Anonimato estructural.** El dato individual nunca existe en el
   sistema; solo agregados por empresa y departamento.
2. **Polaridad declarada.** Un "5" no siempre significa lo mismo. Cada
   pregunta declara si número alto = bueno (DIRECTA), número alto = malo
   (INVERSA) o no puntúa (NEUTRA / demográfica).
3. **Porcentaje sobre cantidad.** El semáforo se prende por porcentaje
   de personal con emociones negativas, no por número absoluto: 80 % de
   un equipo pequeño exige atención igual que 80 % de uno grande.

---

## Flujo de datos completo

```
┌──────────────────┐         ┌───────────────┐
│ Microsoft Forms  │ ──────▶ │ Excel vinculado│
└──────────────────┘         │ (OneDrive)     │
                             └───────┬───────┘
                                     │ cada 40 s
                                     ▼
                             ┌────────────────┐
                             │  n8n           │
                             │  (FormsIngest) │
                             └───────┬────────┘
                                     │ POST /responses/ingest/batch
                                     ▼
                  ┌────────────────────────────────────┐
                  │  Backend Node + Express + mysql2   │
                  │                                    │
                  │  1. Hash anti-duplicados (SHA256)  │
                  │  2. ¿Pregunta conocida?            │
                  │     · sí → puntuar                 │
                  │     · no → Gemini sugiere polaridad│
                  │             → estado PENDIENTE     │
                  │  3. Normalizar a 0-100 + polaridad │
                  │  4. Clasificar POSITIVO/NEUTRO/NEG │
                  │  5. Persistir en MySQL             │
                  │  6. Recalcular agregado por respta │
                  └────────────────┬───────────────────┘
                                   │
                  ┌────────────────┴───────────────────┐
                  ▼                                    ▼
       ┌──────────────────┐                ┌──────────────────────┐
       │ Snapshots cron   │                │ Semáforo cron diario │
       │ (MonthlySnapshot)│                │ (AlertRefresh)       │
       └──────────────────┘                └──────────────────────┘
                                   ▲
                                   │
                  ┌────────────────┴───────────────────┐
                  │  Frontend SPA (React + Tailwind)   │
                  │  6 paneles · JWT · sesión persist. │
                  └────────────────────────────────────┘
```

---

## Reglas innegociables aplicadas en cada panel

Cada vista respeta estas reglas sin excepciones:

- **Umbral mínimo de respuestas.** Si un departamento tiene menos de
  `MIN_RESPUESTAS_DEPARTAMENTO` (5 por defecto), no se muestra aislado.
  Su dato se absorbe en el agregado de empresa, pero no se expone como
  unidad propia. Esto evita que un 80 % negativo en un equipo de 2
  personas identifique implícitamente a alguien.
- **Respuestas en espera.** Si la polaridad de una pregunta no está
  confirmada por RRHH, esa respuesta queda `EN_ESPERA` y no entra al
  cálculo de ningún panel. Una mala polaridad podría contaminar al
  departamento entero, por eso siempre hay confirmación humana.
- **Snapshots inmutables.** Una vez cerrado un mes, sus agregados no
  cambian. Las comparativas año contra año son confiables incluso si
  llegan respuestas tardías.

---

## Los 6 paneles

### 1. Asistente (Dashboard)

**Ruta:** `/`
**Quién la usa:** todo RRHH al entrar.
**Panel del plan:** #3 — Asistente de notificaciones.

#### Qué hace

Es la pantalla de bienvenida. Al iniciar sesión, RRHH recibe un resumen
proactivo de focos del período actual: cuántos departamentos están en
rojo, cuántos en amarillo, y la lista priorizada por % negativo.

#### Pregunta que responde

> *"¿Qué necesita atención inmediata hoy?"*

#### Componentes visuales

- 3 tarjetas KPI: período actual, departamentos en rojo,
  departamentos en amarillo.
- Lista priorizada con: nombre del departamento, empresa, nivel
  (pill VERDE/AMARILLO/ROJO), % negativo, enlace al detalle.

#### Endpoints consumidos

- `GET /api/alerts/focos`

#### Potencial

- Notificaciones por correo cuando un nuevo depto cae a rojo.
- Botón "agendar visita" que cree un evento en Outlook/Google Calendar.
- Resumen narrativo generado por Gemini ("este mes 3 deptos
  retrocedieron…").

---

### 2. Comparador

**Ruta:** `/comparador`
**Panel del plan:** #1.

#### Qué hace

Permite poner lado a lado hasta **3 empresas o 3 departamentos** en el
mismo período y comparar sentimiento general más posición en el ranking
global.

#### Preguntas que responde

> *"¿Cómo se compara mi empresa con la competencia interna?"*
> *"¿En qué puesto del ranking estamos por % positivo?"*
> *"¿Cuál de mis departamentos jala los promedios hacia abajo?"*

#### Componentes visuales

- 3 selectores de entidad (depende de modo: empresa o departamento).
- 3 tarjetas KPI con % positivo de cada selección.
- Gráfico apilado (positivo/neutro/negativo) por entidad — Recharts.
- Tabla del ranking global (Top-20) con la fila de las entidades
  seleccionadas destacada en azul.

#### Endpoints consumidos

- `GET /api/aggregates/compare`
- `GET /api/rankings?tipo=GLOBAL`

#### Potencial

- Comparar por **dimensión específica** (Liderazgo, Orgullo, etc.).
- Comparar la misma entidad contra sí misma en dos períodos
  ("yo de junio vs yo de mayo").
- Insight automático: "Empresa X subió 3 puestos respecto al mes
  anterior".

---

### 3. Semáforo de alertas

**Ruta:** `/semaforo`
**Panel del plan:** #2.

#### Qué hace

Lista exhaustiva de departamentos con su nivel actual (VERDE / AMARILLO
/ ROJO) según el % de respuestas negativas. Permite marcar alertas como
"atendidas" (visita realizada) y disparar un recálculo manual.

#### Pregunta que responde

> *"¿A qué departamentos hay que visitar esta semana, y cuáles ya cubrimos?"*

#### Componentes visuales

- Filtros: período, nivel, atendida sí/no.
- Botón "Recalcular semáforo" → recorre departamentos y reclasifica.
- Tabla con: pill nivel, departamento, empresa, % negativo, estado
  "atendida" + fecha, botón "Marcar atendida" (pide notas).

#### Niveles del semáforo (configurables en `.env`)

- **VERDE** — % negativo < `SEMAFORO_AMARILLO_MIN` (default 40).
- **AMARILLO** — entre 40 y 75 → zona de observación.
- **ROJO** — ≥ `SEMAFORO_ROJO_MIN` (default 75) → exige intervención.

#### Endpoints consumidos

- `GET /api/alerts`
- `POST /api/alerts/recalculate`
- `POST /api/alerts/:id/atender`

#### Potencial

- Workflow de seguimiento: tras marcar atendida, agendar un
  recheck a los 30 días.
- Adjuntar acta de visita (PDF/Markdown) a la alerta.
- Dashboard agregado: cuántos focos rojos se resolvieron este trimestre.

---

### 4. Tendencias e histórico

**Ruta:** `/tendencias`
**Panel del plan:** #4.

#### Qué hace

Combina los **snapshots mensuales inmutables** con análisis temporal
fino: evolución del % positivo y negativo a lo largo del tiempo, mapa
de calor por día de la semana y detección de cronicidad (cuántos meses
consecutivos en alerta).

#### Preguntas que responde

> *"¿Esto es un mes malo o llevan meses así?"*
> *"¿Las emociones negativas se concentran en lunes?"*
> *"¿Cómo evolucionó el clima de este equipo en el último año?"*

#### Componentes visuales

- 3 tarjetas KPI: nivel actual, meses consecutivos en alerta, total de
  snapshots consultados.
- Indicador "caso crónico" cuando lleva ≥ 3 meses consecutivos en
  amarillo o rojo.
- Línea temporal con % positivo vs % negativo mes a mes.
- Barras con % negativo por día de la semana (lunes, martes, …).

#### Endpoints consumidos

- `GET /api/snapshots/history`
- `GET /api/temporal/day-of-week`
- `GET /api/temporal/cronicidad`

#### Potencial

- Predicción: extrapolar la tendencia y proyectar 1-2 meses.
- Anotaciones en el gráfico: marcar cambios organizacionales relevantes
  (reorgs, despidos, lanzamientos) para correlacionar.
- Comparar tendencia del departamento contra el promedio de su empresa.

---

### 5. Catálogo de preguntas

**Ruta:** `/catalogo`
**Panel del plan:** #5.

#### Qué hace

Bandeja de revisión para preguntas que Microsoft Forms aporta y que
Gemini todavía no validó humanamente. Por cada pregunta nueva, muestra
la sugerencia de la IA con su razonamiento y confianza, y permite a
RRHH **confirmar**, **corregir** o **rechazar**.

#### Pregunta que responde

> *"¿Cómo enseñamos al sistema a entender una pregunta nueva sin que
> introduzca sesgos?"*

#### Componentes visuales

- Lista de tarjetas, una por pregunta pendiente.
- Cada tarjeta muestra: texto de la pregunta, dimensión sugerida,
  polaridad sugerida, razón en lenguaje natural, % de confianza.
- 3 acciones: Confirmar sugerencia · Corregir (elegir otra polaridad) ·
  Rechazar (la deja pendiente).

#### Endpoints consumidos

- `GET /api/classifications`
- `POST /api/classifications/:id/confirm`

#### Comportamiento crítico

Cuando RRHH confirma o corrige una polaridad, **todas las respuestas
que habían entrado en estado `EN_ESPERA` por esa pregunta se reprocesan
retroactivamente en una sola transacción**. El backend recalcula sus
puntuaciones, su sentimiento y el agregado de la respuesta padre. Es
por esto que ninguna respuesta de una pregunta pendiente puede
contaminar el semáforo: simplemente no entra al cálculo hasta que sea
oficialmente clasificada.

#### Potencial

- Vista de cambios: registrar quién confirmó qué y cuándo, con
  posibilidad de revertir.
- Bandeja por dimensión (mostrar solo preguntas pendientes de la
  dimensión "Liderazgo").
- Sugerir ediciones del texto de la pregunta cuando Gemini detecta
  ambigüedad.

---

### 6. Generador de presentación

**Ruta:** `/presentacion`
**Panel del plan:** #6.
**Estado:** **stub UI — Fase 6 pendiente.**

#### Qué hará

Generar un `.pptx` editable con la estructura del informe de clima
existente: portada, resumen ejecutivo, bloques por dimensión con tabla
de % por opción ("el 73 % del personal indica que…"), mejores y peores
resultados, y temas detectados por Gemini en respuestas abiertas.

#### Por qué `.pptx` y no PDF

RRHH debe poder **corregir o quitar información sensible al instante**
antes de presentar. Un PDF no permite eso con facilidad; un `.pptx`
abierto en PowerPoint sí.

#### Plantilla maestra

La idea es que RRHH provea un `.pptx` con marcadores (estilo "machote")
y PptxGenJS reemplace los placeholders con datos del período
seleccionado. El branding lo controla RRHH sin tocar código.

#### Potencial

- Modo "presentación ejecutiva" más conciso vs "informe detallado".
- Exportar también a Google Slides vía API.
- Generar narrativa con Gemini: "este trimestre los puntos de mejora
  son X, Y, Z" como párrafo introductorio.

---

## Roles de usuario

Definidos en la tabla `users` y enforced por `requireRole()`:

| Rol | Capacidades |
| --- | --- |
| **ADMIN** | Todo lo anterior + cerrar snapshots manualmente, recalcular alertas, gestionar usuarios (a futuro). |
| **ANALISTA** | Ver paneles, confirmar polaridades, marcar alertas como atendidas. |

El token JWT incluye `role` y los endpoints sensibles verifican antes
de ejecutar.

---

## Potencial a futuro

Más allá de la Fase 6:

### Producto
- **Encuestas pulso semanales:** además de la encuesta anual, micro-pulsos
  cortos (1-3 preguntas) por canal Slack/Teams para detectar cambios
  rápidos.
- **Vista para líderes de equipo:** una versión read-only del panel de
  su departamento (respetando umbral mínimo) para que el gerente vea su
  propio semáforo.
- **Tablero comparativo industrial:** anonimizar y comparar contra
  benchmarks del sector.

### Inteligencia artificial
- **Sugerencias de intervención:** Gemini propone acciones específicas
  según los temas detectados en texto abierto ("considerar capacitación
  en gestión del estrés porque 18 menciones lo señalan").
- **Detección de temas emergentes:** clustering de respuestas abiertas
  para identificar problemas nuevos antes de que un % los haga visibles.
- **Validación cruzada:** si Gemini sugiere una polaridad con confianza
  baja, mostrar 2-3 ejemplos de respuestas reales para ayudar a RRHH a
  decidir.

### Seguridad y operación
- **MFA** para usuarios ADMIN.
- **Audit log** de toda acción que escribe (confirmar polaridad, marcar
  atendida, cerrar snapshot).
- **Cifrado at-rest** para texto abierto si llegara a contener datos
  sensibles a pesar del anonimato.

### Integraciones
- **Calendario:** agendar visitas a deptos en rojo directamente desde
  el Semáforo.
- **Slack/Teams:** notificación automática cuando un depto cae a rojo.
- **Power BI / Tableau:** view materializada de los snapshots
  inmutables para que analistas externos puedan crear sus propios
  dashboards sin tocar la base operativa.
