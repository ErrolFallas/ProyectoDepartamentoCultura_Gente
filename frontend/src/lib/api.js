const STORAGE_KEY = 'pulsework.token';

export const tokenStore = {
  get() {
    return localStorage.getItem(STORAGE_KEY);
  },
  set(t) {
    localStorage.setItem(STORAGE_KEY, t);
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, query, signal } = {}) {
  const url = buildUrl(path, query);
  const headers = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const init = { method, headers, signal };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (networkErr) {
    throw new ApiError(`No se pudo conectar al backend (${networkErr.message})`, { status: 0 });
  }

  if (res.status === 204) return null;

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(err.message || res.statusText, {
      status: res.status,
      code: err.code,
      details: err.details
    });
  }
  return data;
}

function buildUrl(path, query) {
  const base = path.startsWith('/api') ? path : `/api${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) params.set(k, v.join(','));
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),

  // Catalogo
  getDimensions: () => request('/catalog/dimensions'),
  getScales: () => request('/catalog/scales'),
  getPendingQuestions: () => request('/catalog/questions/pending'),

  // Clasificaciones
  getClassifications: () => request('/classifications'),
  confirmClassification: (id, body) => request(`/classifications/${id}/confirm`, { method: 'POST', body }),

  // Agregados
  aggregateScope: (query) => request('/aggregates/scope', { query }),
  aggregateQuestion: (query) => request('/aggregates/question', { query }),
  aggregateDistribution: (query) => request('/aggregates/question/distribution', { query }),
  compare: (query) => request('/aggregates/compare', { query }),

  // Snapshots
  snapshotsClose: (periodo) => request('/snapshots/close', { method: 'POST', body: { periodo } }),
  snapshotsList: (query) => request('/snapshots', { query }),
  snapshotsHistory: (query) => request('/snapshots/history', { query }),

  // Rankings
  getRanking: (query) => request('/rankings', { query }),
  recomputeRanking: (query) => request('/rankings/recompute', { method: 'POST', query }),

  // Alertas
  listAlerts: (query) => request('/alerts', { query }),
  focos: (query) => request('/alerts/focos', { query }),
  recalculateAlerts: (periodo) => request('/alerts/recalculate', { method: 'POST', body: { periodo } }),
  atenderAlerta: (id, { notas, atendidaAt } = {}) => request(`/alerts/${id}/atender`, {
    method: 'POST',
    body: { notas, atendida_at: atendidaAt }
  }),
  desmarcarAlerta: (id, motivo) => request(`/alerts/${id}/desmarcar`, {
    method: 'POST',
    body: { motivo }
  }),
  detalleAlerta: (id) => request(`/alerts/${id}/detalle`),

  // Temporal
  dayOfWeek: (query) => request('/temporal/day-of-week', { query }),
  cronicidad: (query) => request('/temporal/cronicidad', { query }),

  health: () => request('/health'),

  // Organización
  listCompanies: () => request('/companies'),
  listDepartments: (companyId) => request(`/companies/${companyId}/departments`),

  // Asistente IA (Gemini con function calling)
  assistantCapabilities: () => request('/assistant/capabilities'),
  assistantQuota: () => request('/assistant/quota'),
  assistantSuggestions: () => request('/assistant/suggestions'),
  assistantAsk: (messages) => request('/assistant/ask', { method: 'POST', body: { messages } }),

  // Presentación (Fase 6)
  presentationPreview: (query) => request('/presentation/preview', { query }),
  presentationDownload: async ({ scope, scope_id, periodo }) => {
    const token = tokenStore.get();
    const res = await fetch('/api/presentation/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ scope, scope_id, periodo })
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = res.statusText;
      try { msg = JSON.parse(text)?.error?.message ?? msg; } catch { /* keep statusText */ }
      throw new ApiError(msg, { status: res.status });
    }
    const blob = await res.blob();
    const filename = parseFilename(res.headers.get('Content-Disposition'))
      ?? `clima_${scope_id}_${periodo}.pptx`;
    return { blob, filename };
  }
};

function parseFilename(header) {
  if (!header) return null;
  const m = header.match(/filename="([^"]+)"/);
  return m ? m[1] : null;
}
