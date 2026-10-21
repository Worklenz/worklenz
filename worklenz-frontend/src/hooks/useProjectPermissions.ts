import { useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import {
  EMPTY_PROJECT_ACCESS,
  ICachedProjectAccess,
} from '@/types/project/project-access.types';
import {
  extractProjectAccess,
  legacyProjectAccessFromManager,
} from '@/utils/project-access.utils';

export interface UseProjectPermissionsResult extends ICachedProjectAccess {
  /** Project id these permissions apply to (null if unknown). */
  projectId: string | null;
  /** True when permissions came from the server payload cache. */
  isReady: boolean;
}

/**
 * Phase 3 — project-scoped permissions keyed by project id.
 * Never falls back to another project's PM state (fixes A→B control leak).
 */
export const useProjectPermissions = (
  explicitProjectId?: string | null
): UseProjectPermissionsResult => {
  const authService = useAuthService();
  const session = authService.getCurrentSession();
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();

  const storeProjectId = useAppSelector(state => state.projectReducer.projectId);
  const project = useAppSelector(state => state.projectReducer.project);
  const permissionsByProjectId = useAppSelector(
    state => state.projectReducer.permissionsByProjectId
  );
  const drawerProjectId = useAppSelector(
    state => state.projectDrawerReducer.projectId
  );
  const drawerProject = useAppSelector(
    state => state.projectDrawerReducer.project
  );

  const projectId =
    explicitProjectId ?? storeProjectId ?? project?.id ?? null;

  return useMemo(() => {
    if (!projectId) {
      return { ...EMPTY_PROJECT_ACCESS, projectId: null, isReady: false };
    }

    const cached = permissionsByProjectId[projectId];
    if (cached) {
      return { ...cached, projectId, isReady: true };
    }

    // Live payload on the matching project (before cache write / merge).
    if (project?.id === projectId) {
      const fromProject = extractProjectAccess(project);
      if (fromProject) {
        return { ...fromProject, projectId, isReady: true };
      }
      return {
        ...legacyProjectAccessFromManager(
          project,
          session?.team_member_id,
          isOwnerOrAdmin
        ),
        projectId,
        isReady: false,
      };
    }

    if (drawerProject?.id === projectId) {
      const fromDrawer = extractProjectAccess(drawerProject);
      if (fromDrawer) {
        return { ...fromDrawer, projectId, isReady: true };
      }
      return {
        ...legacyProjectAccessFromManager(
          drawerProject,
          session?.team_member_id,
          isOwnerOrAdmin
        ),
        projectId,
        isReady: false,
      };
    }

    // Unknown project — deny elevated controls (do not reuse another project's PM).
    return { ...EMPTY_PROJECT_ACCESS, projectId, isReady: false };
  }, [
    projectId,
    permissionsByProjectId,
    project,
    drawerProject,
    drawerProjectId,
    session?.team_member_id,
    isOwnerOrAdmin,
  ]);
};

export default useProjectPermissions;
