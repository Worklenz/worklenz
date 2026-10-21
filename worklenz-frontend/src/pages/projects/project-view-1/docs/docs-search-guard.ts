import { useCallback, useEffect, useRef } from 'react';

interface DocsSearchLife {
  disposed: boolean;
  pathname: string;
  requiresDocsTab: boolean;
}

/** True while this docs screen is still the page the address bar is showing. */
export const canWriteDocsSearch = (life: DocsSearchLife) => {
  if (life.disposed) return false;
  if (window.location.pathname !== life.pathname) return false;
  if (life.requiresDocsTab && new URLSearchParams(window.location.search).get('tab') !== 'docs')
    return false;
  return true;
};

export const useDocsSearchReplace = (
  setSearchParams: (next: URLSearchParams, options?: { replace?: boolean }) => void
) => {
  const life = useRef<DocsSearchLife>({
    disposed: false,
    pathname: window.location.pathname,
    requiresDocsTab: new URLSearchParams(window.location.search).get('tab') === 'docs',
  });

  useEffect(() => {
    life.current.disposed = false;
    return () => {
      life.current.disposed = true;
    };
  }, []);

  return useCallback(
    (next: URLSearchParams) => {
      if (!canWriteDocsSearch(life.current)) return;
      setSearchParams(next, { replace: true });
    },
    [setSearchParams]
  );
};
