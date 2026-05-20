export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  const message = error?.message ?? 'Error inesperado';
  return (
    <div className="rounded-lg border border-semaforo-rojo/30 bg-semaforo-rojo/5 px-4 py-3 text-sm text-semaforo-rojo">
      <div className="font-medium">No se pudo cargar la información</div>
      <div className="opacity-80">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs underline">
          Reintentar
        </button>
      )}
    </div>
  );
}
