import { createHash } from 'node:crypto';

/**
 * Hash SHA256 hexadecimal estable a partir de la fila origen del Excel de Forms.
 * Se incluyen submitted_at + empresa + departamento + todas las respuestas
 * en el orden recibido para que dos lecturas de la misma fila produzcan el mismo hash.
 */
export function sourceRowHash({ submittedAt, company, department, answers }) {
  const hasher = createHash('sha256');
  hasher.update(String(submittedAt ?? ''));
  hasher.update('|');
  hasher.update(String(company ?? '').trim().toLowerCase());
  hasher.update('|');
  hasher.update(String(department ?? '').trim().toLowerCase());
  hasher.update('|');
  for (const a of answers ?? []) {
    hasher.update(String(a?.question ?? '').trim().toLowerCase());
    hasher.update('=');
    hasher.update(String(a?.value ?? '').trim());
    hasher.update(';');
  }
  return hasher.digest('hex');
}
