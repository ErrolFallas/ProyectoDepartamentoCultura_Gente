export function pct(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(digits)}%`;
}

export function numFmt(n) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-CR').format(n);
}

export function dateShort(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function currentPeriodMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nivelColor(nivel) {
  if (nivel === 'ROJO') return 'bg-semaforo-rojo text-white';
  if (nivel === 'AMARILLO') return 'bg-semaforo-amarillo text-ink-900';
  return 'bg-semaforo-verde text-white';
}

export function nivelDot(nivel) {
  if (nivel === 'ROJO') return 'bg-semaforo-rojo';
  if (nivel === 'AMARILLO') return 'bg-semaforo-amarillo';
  return 'bg-semaforo-verde';
}
