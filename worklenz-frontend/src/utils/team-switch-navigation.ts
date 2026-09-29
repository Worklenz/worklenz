const PROJECTS_LIST_PATH = '/worklenz/projects';
const TASK_SHORT_LINK_PREFIX = '/worklenz/t/';

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
 * Full-page navigate after a team switch so the new session is applied.
 * Leaves shared pages in place via reload; leaves project-scoped pages.
 */
export const navigateAfterTeamSwitch = (pathname: string): void => {
  const target = getPostTeamSwitchLocation(pathname);

  if (target === pathname) {
    window.location.reload();
    return;
  }

  window.location.assign(target);
};
