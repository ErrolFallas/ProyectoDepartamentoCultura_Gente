import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Hook genérico para invocar una promesa de API. Devuelve { data, error,
 * loading, reload }. Cancela peticiones obsoletas si las dependencias
 * cambian antes de resolver.
 *
 * @param fn       función que retorna una Promise (recibe AbortSignal opcional)
 * @param deps     array de dependencias; null = no auto-ejecutar
 */
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(deps !== null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fnRef.current();
      setData(r);
      return r;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (deps === null) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fnRef.current();
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps ?? []);

  return { data, error, loading, reload: run, setData };
}
