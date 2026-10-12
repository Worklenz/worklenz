import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import ReportingControllerBase from "../controllers/reporting/reporting-controller-base";
import { isTeamOwner, isTeamAdmin, isTeamLeadFromSession } from "./team-permissions";

/**
 * A viewer's resolved read-visibility scope for the Time Entries page.
 *
 * - teamWide: Owner/Admin — sees every entry, every project, no extra filter.
 * - expandedProjectIds: the union of projects where this viewer has PM or
 *   Team-Lead-derived expanded access. Their own entries are always visible
 *   everywhere regardless of this list (that's the "my" scope, unconditional).
 *
 * This is the single source of truth for "what can this person see" on this
 * page — every query builds its scope predicate from here. A client-supplied
 * `scope=all` is never trusted at face value; callers must combine this with
 * buildTimeEntriesScopePredicate (below), which downgrades to "my" for anyone
 * without an expanded scope.
 */
export interface ITimeEntriesVisibilityScope {
  teamWide: boolean;
  isTeamLead: boolean;
  isProjectManagerAnywhere: boolean;
  teamLeadProjectIds: string[];
  pmProjectIds: string[];
  expandedProjectIds: string[];
  hasExpandedScope: boolean;
}

const EMPTY_SCOPE: ITimeEntriesVisibilityScope = {
  teamWide: false,
  isTeamLead: false,
  isProjectManagerAnywhere: false,
  teamLeadProjectIds: [],
  pmProjectIds: [],
  expandedProjectIds: [],
  hasExpandedScope: false,
};

export async function resolveTimeEntriesVisibilityScope(
  req: IWorkLenzRequest
): Promise<ITimeEntriesVisibilityScope> {
  const userId = req.user?.id;
  const teamId = req.user?.team_id;

  if (!userId || !teamId) return EMPTY_SCOPE;

  // Owner/Admin takes precedence over any stored role_name (mirrors
  // getEffectiveTeamRole's own precedence) — no need to also check Team
  // Lead/PM project lists once team-wide access is already established.
  if (isTeamOwner(req.user) || isTeamAdmin(req.user)) {
    return { ...EMPTY_SCOPE, teamWide: true, hasExpandedScope: true };
  }

  const isTL = isTeamLeadFromSession(req.user);
  const [teamLeadProjectIds, pmProjectIds] = await Promise.all([
    isTL ? ReportingControllerBase.getTeamLeadProjects(userId, teamId) : Promise.resolve([] as string[]),
    ReportingControllerBase.getPmProjectIds(userId, teamId),
  ]);
  const expandedProjectIds = Array.from(new Set([...teamLeadProjectIds, ...pmProjectIds]));

  return {
    teamWide: false,
    isTeamLead: isTL,
    isProjectManagerAnywhere: pmProjectIds.length > 0,
    teamLeadProjectIds,
    pmProjectIds,
    expandedProjectIds,
    hasExpandedScope: expandedProjectIds.length > 0,
  };
}

export interface IScopePredicate {
  /** SQL fragment usable directly in a WHERE clause, e.g. "twl.user_id = $1". */
  clause: string;
  /** Next free 1-based parameter index after any params this predicate pushed. */
  nextParamIdx: number;
}

/**
 * Builds the row-inclusion predicate for a time-log query. `projectIdColumn`
 * must reference the row's project id (e.g. "t1.project_id" or "pr.id")
 * exactly as it appears in the query this predicate is spliced into.
 *
 * NOTE for callers: the team-wide branch (Owner/Admin, scope "all") returns a
 * bare `TRUE` and never references the own-user param. Every query that uses
 * this helper must therefore reference `$<ownUserIdParamIdx>` somewhere else
 * (e.g. the archived-projects exclusion) — Postgres cannot infer the type of a
 * parameter no expression uses and fails with 42P18.
 *
 * A requested `scope` of "all" from a viewer with no expanded scope (a plain
 * Member) is silently downgraded to "my" — never trust the client's
 * requested scope. When expandedProjectIds is empty, `= ANY('{}'::uuid[])`
 * degrades to FALSE on its own, so the OR'd clause naturally collapses to
 * "own entries only" without a separate branch.
 */
export function buildTimeEntriesScopePredicate(
  requestedScope: string | undefined,
  ownUserIdParamIdx: number,
  projectIdColumn: string,
  scope: ITimeEntriesVisibilityScope,
  params: any[]
): IScopePredicate {
  if (requestedScope !== "all" || !scope.hasExpandedScope) {
    return { clause: `twl.user_id = $${ownUserIdParamIdx}`, nextParamIdx: params.length + 1 };
  }

  if (scope.teamWide) {
    return { clause: `TRUE`, nextParamIdx: params.length + 1 };
  }

  const idx = params.length + 1;
  params.push(scope.expandedProjectIds);
  return {
    clause: `(twl.user_id = $${ownUserIdParamIdx} OR ${projectIdColumn} = ANY($${idx}::uuid[]))`,
    nextParamIdx: idx + 1,
  };
}
