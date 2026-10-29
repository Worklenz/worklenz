/** Default number of projects shown on analytics bar charts when no project filter is set. */
export const DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT = 20;

interface WithUpdatedAt {
  updated_at?: string | null;
}

interface WithProjectId extends WithUpdatedAt {
  project_id: string;
}

export const sortProjectsByUpdatedAtDesc = <T extends WithUpdatedAt>(projects: T[]): T[] =>
  [...projects].sort((a, b) => {
    const aTs = a.updated_at ? Date.parse(a.updated_at) : 0;
    const bTs = b.updated_at ? Date.parse(b.updated_at) : 0;
    return bTs - aTs;
  });

/**
 * Chart rows: latest N when no explicit project filter; otherwise every
 * project returned by the API (e.g. after Select all).
 */
export const projectsForAnalyticsChart = <T extends WithUpdatedAt>(
  projects: T[],
  options: { explicitProjectFilter: boolean; limit?: number }
): T[] => {
  const sorted = sortProjectsByUpdatedAtDesc(projects);
  if (options.explicitProjectFilter) return sorted;
  return sorted.slice(0, options.limit ?? DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT);
};

/** Ids of the N most recently updated projects — used as the default filter selection. */
export const latestUpdatedProjectIds = (
  projects: WithProjectId[],
  limit = DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT
): string[] =>
  sortProjectsByUpdatedAtDesc(projects)
    .slice(0, limit)
    .map(project => project.project_id);

/**
 * Same as latestUpdatedProjectIds but for overview/filter option shapes (`id` + `updated_at`).
 */
export const latestUpdatedOptionIds = (
  projects: Array<{ id: string; updated_at?: string | null }>,
  limit = DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT
): string[] =>
  sortProjectsByUpdatedAtDesc(projects)
    .slice(0, limit)
    .map(project => project.id);
