/**
 * Shared SQL fragments for "non-guest" access checks.
 * Guest status is stored on team_members and is set by a project invitation
 * with GUEST access. Project visibility remains separately controlled by an
 * explicit project_members row.
 * Assumes the query already has `p` (projects) in scope and binds the
 * user id as the join parameter used below.
 */
export const NON_GUEST_ACCESS_JOIN = (userIdParam: string) => `
  INNER JOIN team_members tm ON tm.team_id = p.team_id AND tm.user_id = ${userIdParam}
  INNER JOIN roles r ON r.id = tm.role_id
`;

/**
 * SQL boolean: the given team_members row is flagged as a guest.
 * Single source of truth for the `is_guest` column check — also used by
 * assignee-task-scope.ts's buildGuestExemptSql, which additionally checks
 * for a project-level GUEST access level (a separate, project-scoped
 * concept this predicate doesn't cover).
 */
export const teamMemberIsGuestPredicate = (teamMemberAlias: string): string =>
  `COALESCE(${teamMemberAlias}.is_guest, FALSE) = TRUE`;

// NOTE: intentionally not built from teamMemberIsGuestPredicate — that helper
// COALESCEs a NULL is_guest to FALSE (i.e. "not a guest"), whereas this
// predicate's `tm.is_guest = FALSE` evaluates NULL to NULL (excluded, fail
// closed). Keep both in sync by hand if the is_guest column's semantics change.
export const NON_GUEST_ACCESS_PREDICATE = `
  tm.active = TRUE
  AND (
    r.owner = TRUE
    OR r.admin_role = TRUE
    OR tm.is_guest = FALSE
  )
`;
