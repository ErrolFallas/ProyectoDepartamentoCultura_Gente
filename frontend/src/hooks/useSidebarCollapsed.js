import { useCallback, useEffect, useState } from 'react';

const KEY = 'pulsework.sidebarCollapsed';

/**
 * Hook compartido para el estado de colapso del sidebar.
 * Persiste el valor en localStorage para que la preferencia
 * sobreviva al refresco de la página.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch { /* noop */ }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((v) => !v), []);
  const hide = useCallback(() => setCollapsed(true), []);
  const show = useCallback(() => setCollapsed(false), []);

  return { collapsed, toggle, hide, show };
}
