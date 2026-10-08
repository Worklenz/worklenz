import { useEffect } from 'react';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchProjectReleases } from '@/features/projects/singleProject/releases/releases.slice';

/** Loads the project's releases when the store holds none (or another project's). */
export const useEnsureProjectReleases = (projectId: string | null | undefined) => {
  const dispatch = useAppDispatch();
  const { projectId: loadedProjectId, isLoading, hasError } = useAppSelector(
    state => state.releasesReducer
  );

  useEffect(() => {
    if (!projectId || loadedProjectId === projectId || isLoading || hasError) return;
    void dispatch(fetchProjectReleases(projectId));
  }, [dispatch, hasError, isLoading, loadedProjectId, projectId]);

  return { isLoading };
};
