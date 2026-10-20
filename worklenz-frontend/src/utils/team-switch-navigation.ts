const PROJECTS_LIST_PATH = '/worklenz/projects';
const TASK_SHORT_LINK_PREFIX = '/worklenz/t/';

/** Team-scoped deep-link params that must not survive a manual team switch. */
const TEAM_SCOPED_SEARCH_PARAMS = ['task', 'task_project', 'comment', 'from', 'drawer_tab'] as const;

/** Matches `/worklenz/projects/:projectId` where projectId is a UUID. */
const PROJECT_DETAIL_PATH_REGEX =
  /^\/worklenz\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/|$)/i;

/**
 * Returns where to navigate after a manual team switch.
 *
 * Project detail URLs (and task short-links that resolve into them) are not
 * valid across teams — reloading them triggers backend auto team-switch back
 * to the project's team. Shared pages (home, projects list, planner, finance)
 * can safely reload in place.
 */
export const getPostTeamSwitchLocation = (pathname: string): string => {
  if (PROJECT_DETAIL_PATH_REGEX.test(pathname)) {
    return PROJECTS_LIST_PATH;
  }

  if (pathname.startsWith(TASK_SHORT_LINK_PREFIX)) {
    return PROJECTS_LIST_PATH;
  }

  return pathname;
};

/**
 * Strip task / comment deep-link query params so a reload after team switch
 * does not auto-open a task that belongs to the previous team (false Access Denied).
 */
export const stripTeamScopedSearchParams = (search: string): string => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  let changed = false;

  for (const key of TEAM_SCOPED_SEARCH_PARAMS) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }

  if (!changed) {
    return search.startsWith('?') || search === '' ? search : `?${search}`;
  }

  const next = params.toString();
  return next ? `?${next}` : '';
};

/**
 * Full-page navigate after a team switch so the new session is applied.
 * Leaves shared pages in place via reload; leaves project-scoped pages.
 * Always drops team-scoped task deep-link query params before reload/assign.
 */
export const navigateAfterTeamSwitch = (pathname: string): void => {
  const targetPath = getPostTeamSwitchLocation(pathname);
  const cleanedSearch =
    targetPath === pathname ? stripTeamScopedSearchParams(window.location.search) : '';
  const target = `${targetPath}${cleanedSearch}${window.location.hash || ''}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;

  if (target === current) {
    window.location.reload();
    return;
  }

  window.location.assign(target);
};
