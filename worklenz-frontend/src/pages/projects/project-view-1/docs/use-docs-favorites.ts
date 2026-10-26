import { useCallback, useEffect, useRef, useState } from 'react';
import { projectDocumentsApiService } from '@/api/projects/docs/project-documents.api.service';
import { teamDocumentsApiService } from '@/api/projects/docs/team-documents.api.service';

/** Favorites are private server state; failures roll back only the affected page. */
export const useDocsFavorites = (projectId: string, scope: 'project' | 'team' = 'project') => {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const inFlight = useRef(new Set<string>());
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    const current = ++generation.current;
    inFlight.current.clear();
    setIds(new Set());
    setPending(new Set());
    setLoading(true);
    setHasError(false);
    const request =
      scope === 'team'
        ? teamDocumentsApiService.favorites()
        : projectDocumentsApiService.favorites(projectId);
    void request
      .then(response => {
        if (generation.current !== current) return;
        if (!response.done) throw new Error('Favorites unavailable');
        setIds(new Set(response.body || []));
      })
      .catch(() => {
        if (generation.current === current) setHasError(true);
      })
      .finally(() => {
        if (generation.current === current) setLoading(false);
      });
    return () => {
      ++generation.current;
    };
  }, [projectId, reload, scope]);

  const toggle = useCallback(
    async (id: string) => {
      if (loading || hasError || inFlight.current.has(id)) return;
      const current = generation.current;
      const wasFavorite = idsRef.current.has(id);
      inFlight.current.add(id);
      setPending(new Set(inFlight.current));
      setIds(previous => {
        const next = new Set(previous);
        if (wasFavorite) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        const response = await projectDocumentsApiService.setFavorite(id, !wasFavorite);
        if (!response.done) throw new Error('Favorite update failed');
        return true;
      } catch {
        if (generation.current === current)
          setIds(previous => {
            const next = new Set(previous);
            if (wasFavorite) next.add(id);
            else next.delete(id);
            return next;
          });
        return false;
      } finally {
        if (generation.current === current) {
          inFlight.current.delete(id);
          setPending(new Set(inFlight.current));
        }
      }
    },
    [hasError, loading]
  );

  return { ids, pending, loading, hasError, toggle, retry: () => setReload(value => value + 1) };
};
