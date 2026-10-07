import useProjectPermissions from '@/hooks/useProjectPermissions';

/**
 * Whether the current user is PM on the given project (default: active project view).
 * Does not OR with the drawer project — that caused PM controls to leak across projects.
 */
const useIsProjectManager = (projectId?: string | null) => {
  const { isProjectManager } = useProjectPermissions(projectId);
  return isProjectManager;
};

export default useIsProjectManager;
