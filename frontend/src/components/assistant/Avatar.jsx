/**
 * Avatares simples para diferenciar visualmente quién habla en el chat.
 * - Usuario: círculo con sus iniciales sobre fondo neutro
 * - IA: círculo con ✦ sobre fondo brand
 */

export function AvatarUsuario({ nombre }) {
  const iniciales = (nombre ?? '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'Ud';
  return (
    <div
      className="h-8 w-8 shrink-0 rounded-full bg-ink-200 text-ink-700
                 flex items-center justify-center text-[11px] font-semibold
                 border border-ink-300"
      title={nombre ?? 'Usuario'}
    >
      {iniciales}
    </div>
  );
}

export function AvatarIA() {
  return (
    <div
      className="h-8 w-8 shrink-0 rounded-full bg-brand-600 text-white
                 flex items-center justify-center text-base
                 shadow-sm"
      title="Asistente IA"
    >
      ✦
    </div>
  );
}
