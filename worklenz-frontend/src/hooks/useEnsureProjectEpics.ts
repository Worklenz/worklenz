import { useEffect } from 'react';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchProjectEpics } from '@/features/projects/singleProject/epics/epics.slice';

/** Loads the project's Epics when the store holds none (or another project's). */
export const useEnsureProjectEpics = (projectId: string | null | undefined) => {
  const dispatch = useAppDispatch();
  const { projectId: loadedProjectId, isLoading, hasError } = useAppSelector(
    state => state.epicsReducer
  );

  useEffect(() => {
    if (!projectId || loadedProjectId === projectId || isLoading || hasError) return;
    void dispatch(fetchProjectEpics(projectId));
  }, [dispatch, hasError, isLoading, loadedProjectId, projectId]);

  return { isLoading };
};
