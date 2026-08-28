import db from "../config/db";

export interface WorkspaceDigestRole {
  teamId: string;
  teamName: string;
  isAdmin: boolean;
  pmProjectIds: string[];
}

/**
 * Resolves each workspace the user belongs to and their effective role in it.
 * Must be called fresh at every send — never cache across sends.
 *
 * Role priority per workspace:
 *   Admin  → roles.admin_role = true OR roles.owner = true
 *   PM     → project_access_level key = 'PROJECT_MANAGER' in at least one project (not Admin ws)
 *   Member → everything else
 */
export async function resolveUserDigestRoles(userId: string): Promise<WorkspaceDigestRole[]> {
  const adminResult = await db.query(
    `SELECT tm.team_id, t.name AS team_name
     FROM team_members tm
     JOIN roles r ON tm.role_id = r.id
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = $1
       AND tm.active = TRUE
       AND (r.admin_role = TRUE OR r.owner = TRUE)`,
    [userId]
  );

  const adminTeamIds = adminResult.rows.map(r => r.team_id);

  const pmResult = await db.query(
    `SELECT pm.project_id, p.team_id, t.name AS team_name
     FROM project_members pm
     JOIN projects p ON p.id = pm.project_id
     JOIN teams t ON t.id = p.team_id
     JOIN team_members tmbr ON tmbr.id = pm.team_member_id
     WHERE tmbr.user_id = $1
       AND pm.project_access_level_id = (
         SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'
       )
       ${adminTeamIds.length > 0 ? `AND p.team_id <> ALL($2::uuid[])` : ""}`,
    adminTeamIds.length > 0 ? [userId, adminTeamIds] : [userId]
  );

  const rolesMap = new Map<string, WorkspaceDigestRole>();

  for (const row of adminResult.rows) {
    rolesMap.set(row.team_id, {
      teamId: row.team_id,
      teamName: row.team_name,
      isAdmin: true,
      pmProjectIds: [],
    });
  }

  for (const row of pmResult.rows) {
    const existing = rolesMap.get(row.team_id);
    if (existing) {
      existing.pmProjectIds.push(row.project_id);
    } else {
      rolesMap.set(row.team_id, {
        teamId: row.team_id,
        teamName: row.team_name,
        isAdmin: false,
        pmProjectIds: [row.project_id],
      });
    }
  }

  // Include Member-only workspaces (user is in team but not admin/PM)
  const memberResult = await db.query(
    `SELECT tm.team_id, t.name AS team_name
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = $1 AND tm.active = TRUE`,
    [userId]
  );

  for (const row of memberResult.rows) {
    if (!rolesMap.has(row.team_id)) {
      rolesMap.set(row.team_id, {
        teamId: row.team_id,
        teamName: row.team_name,
        isAdmin: false,
        pmProjectIds: [],
      });
    }
  }

  return Array.from(rolesMap.values());
}

export function isAdminInAnyWorkspace(roles: WorkspaceDigestRole[]): boolean {
  return roles.some(r => r.isAdmin);
}

export function isPMInAnyWorkspace(roles: WorkspaceDigestRole[]): boolean {
  return roles.some(r => r.pmProjectIds.length > 0);
}

export function getAdminTeamIds(roles: WorkspaceDigestRole[]): string[] {
  return roles.filter(r => r.isAdmin).map(r => r.teamId);
}

export function getAllPmProjectIds(roles: WorkspaceDigestRole[]): string[] {
  return roles.flatMap(r => r.pmProjectIds);
}

/** Projects visible to "assigned by me" queries, scoped by role. */
export function getAssignedByMeScope(roles: WorkspaceDigestRole[]): { adminTeamIds: string[]; pmProjectIds: string[] } {
  return {
    adminTeamIds: getAdminTeamIds(roles),
    pmProjectIds: getAllPmProjectIds(roles),
  };
}
