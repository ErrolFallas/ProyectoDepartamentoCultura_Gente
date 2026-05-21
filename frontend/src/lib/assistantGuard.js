/**
 * Filtro local que rechaza preguntas peligrosas o fuera de alcance antes
 * de gastarles cuota a Gemini. Es complementario al SYSTEM_INSTRUCTION
 * del backend, no un reemplazo: si alguien hace bypass del frontend
 * (curl directo al API), el backend igual rechaza la pregunta.
 *
 * Patrones detectados:
 *  - Credenciales / secretos
 *  - Prompt injection / cambio de rol
 *  - Acceso a configuración / código fuente
 */

const PATRONES_BLOQUEADOS = [
  {
    rx: /\b(contrase[ñn]a|password|passw[oó]rd|credencial(es)?|api[\s-]?key|token|secret(o|os)?|clave[\s-]?(api|jwt|db|de\s+(la\s+)?base)?)\b/i,
    motivo: 'Solicitud de credenciales o secretos'
  },
  {
    rx: /\b(ignor[aá]|olvid[aá]|olvide|desactiv[aá]|deshabilit[aá])\s+(tus|las|estas|todas\s+(las|tus))\s+(instrucciones|reglas|restricciones|directivas|guard[a-z]*)\b/i,
    motivo: 'Intento de invalidar las instrucciones del asistente'
  },
  {
    rx: /\b(actu[aá]|act[uú]a|comp[oó]rtate|finge|pretende|imagina\s+que\s+eres)\s+(como|de)\b/i,
    motivo: 'Intento de cambiar el rol del asistente'
  },
  {
    rx: /\b(jailbreak|dan\s+mode|sin\s+filtros?|sin\s+restricciones?|modo\s+dios|modo\s+admin)\b/i,
    motivo: 'Intento de jailbreak'
  },
  {
    rx: /\b(system[\s-]?prompt|prompt\s+(del\s+)?sistema|tu\s+prompt|instrucciones?\s+(del\s+)?sistema)\b/i,
    motivo: 'Solicitud del prompt interno'
  },
  {
    rx: /\b(\.env|variables?\s+de\s+entorno|environment\s+variables?|process\.env|config(uraci[oó]n)?\s+(del\s+)?servidor)\b/i,
    motivo: 'Solicitud de configuración del servidor'
  },
  {
    rx: /\b(c[oó]digo\s+fuente|source\s+code|repositorio|github|ssh|root|sudo|filesystem|sistema\s+de\s+archivos)\b/i,
    motivo: 'Solicitud de acceso al sistema'
  },
  {
    rx: /\b(drop\s+table|delete\s+from|insert\s+into|update\s+\w+\s+set|truncate)\b/i,
    motivo: 'Intento de manipulación SQL'
  }
];

export function validarPregunta(texto) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) return { allowed: false, motivo: 'La pregunta está vacía' };
  if (limpio.length > 1000) {
    return { allowed: false, motivo: 'La pregunta excede 1000 caracteres' };
  }
  for (const p of PATRONES_BLOQUEADOS) {
    if (p.rx.test(limpio)) {
      return {
        allowed: false,
        motivo: p.motivo,
        explicacion:
          'El asistente solo responde sobre clima organizacional. ' +
          'Por seguridad no procesamos preguntas sobre credenciales, configuración del sistema ni intentos de cambiar su comportamiento.'
      };
    }
  }
  return { allowed: true };
}
