/**
 * Shared SQL fragments for "non-guest" access checks.
 * Guest status is only conferred by an explicit project_members row whose
 * access level is GUEST (see verify-guest-view-access.ts) — team members
 * with no project_members row have ordinary, implicit, non-guest access to
 * their team's projects. So a user passes when they own/admin the team, have
 * no project_members row for this project, or have one whose access level
 * isn't GUEST. They're denied only when explicitly given GUEST access.
 * Assumes the query already has `p` (projects) in scope and binds the
 * user id as the join parameter used below.
 */
export const NON_GUEST_ACCESS_JOIN = (userIdParam: string) => `
  INNER JOIN team_members tm ON tm.team_id = p.team_id AND tm.user_id = ${userIdParam}
  INNER JOIN roles r ON r.id = tm.role_id
  LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.team_member_id = tm.id
  LEFT JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
`;

export const NON_GUEST_ACCESS_PREDICATE = `
  tm.active = TRUE
  AND (
    r.owner = TRUE
    OR r.admin_role = TRUE
    OR pm.id IS NULL
    OR pal.key <> 'GUEST'
  )
`;
