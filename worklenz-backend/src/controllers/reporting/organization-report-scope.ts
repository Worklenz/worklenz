import { SqlHelper } from '../../shared/sql-helpers';

/** Organization scope is always enforced, including when callers provide IDs. */
export function buildOrganizationReportScope(
  currentTeamId: string | null,
  teams: string[],
  projects: string[],
  paramOffset: number,
  ignoreFilters = false
): { clause: string; params: string[] } {
  if (!currentTeamId) throw new Error("A current team is required for organization reports");
  const params = [currentTeamId];
  let clause = `AND in_organization(p.team_id, $${paramOffset})`;
  if (!ignoreFilters && projects.length) {
    const filter = SqlHelper.buildInClause(projects, paramOffset + params.length);
    clause += ` AND p.id IN (${filter.clause})`;
    params.push(...filter.params);
  } else if (!ignoreFilters && teams.length) {
    const filter = SqlHelper.buildInClause(teams, paramOffset + params.length);
    clause += ` AND p.team_id IN (${filter.clause})`;
    params.push(...filter.params);
  }
  return { clause, params };
}
