import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import logger from '@/utils/errorLogger';

/** Coalesce sprint events while keeping queued requests scoped to the open project. */
export const useSprintPhaseRefresh = (projectId: string | null | undefined) => {
  const dispatch = useAppDispatch();
  const currentProjectRef = useRef(projectId);
  const isRefreshingRef = useRef(false);
  const hasQueuedRefreshRef = useRef(false);

  useEffect(() => {
    currentProjectRef.current = projectId;
    return () => {
      currentProjectRef.current = null;
      hasQueuedRefreshRef.current = false;
    };
  }, [projectId]);

  return useCallback(async () => {
    if (!currentProjectRef.current) return;
    if (isRefreshingRef.current) {
      hasQueuedRefreshRef.current = true;
      return;
    }

    isRefreshingRef.current = true;
    try {
      do {
        hasQueuedRefreshRef.current = false;
        const currentProjectId = currentProjectRef.current;
        if (!currentProjectId) break;
        try {
          await dispatch(fetchPhasesByProjectId(currentProjectId)).unwrap();
        } catch (error) {
          logger.error('Handle Project Sprints Updated Error:', error);
        }
      } while (hasQueuedRefreshRef.current);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [dispatch]);
};
