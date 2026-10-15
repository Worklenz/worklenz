import { IWorkLenzRequest } from '../interfaces/worklenz-request';
import { IWorkLenzResponse } from '../interfaces/worklenz-response';
import db from '../config/db';
import { ServerResponse } from '../models/server-response';
import WorklenzControllerBase from './worklenz-controller-base';
import HandleExceptions from '../decorators/handle-exceptions';
import { IGrantUpdate } from '../types/permission-schemes.types';
import {
  DEFAULT_GRANTS,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLES,
  getOrganizationPermissions,
  INHERITED_PERMISSION_SOURCES,
  PROJECT_PERMISSIONS,
} from '../shared/organization-permissions';

// ---------------------------------------------------------------------------
// Helpers — seed the default scheme and backfill any missing default grants
// ---------------------------------------------------------------------------

type Queryable = Pick<typeof db, 'query'>;

// Existing grants are never overwritten, so admin edits are preserved
async function insertMissingDefaultGrants(queryable: Queryable, schemeId: string): Promise<void> {
  await queryable.query(
    `INSERT INTO permission_scheme_roles (scheme_id, role_name, sort_order)
     SELECT $1, role_name, sort_order
     FROM UNNEST($2::TEXT[], $3::INT[]) AS r(role_name, sort_order)
     ON CONFLICT (scheme_id, role_name) DO NOTHING`,
    [schemeId, DEFAULT_ROLES.map(role => role.name), DEFAULT_ROLES.map(role => role.sort)]
  );

  const sourceGrantsRes = await queryable.query(
    `SELECT role_name, permission, granted
     FROM permission_scheme_grants
     WHERE scheme_id = $1 AND permission = ANY($2::TEXT[])`,
    [schemeId, Object.values(INHERITED_PERMISSION_SOURCES)]
  );
  const sourceGrants = new Map<string, boolean>(
    sourceGrantsRes.rows.map(row => [`${row.role_name}|||${row.permission}`, row.granted as boolean])
  );

  const grantRows = DEFAULT_PERMISSIONS.flatMap(permission =>
    DEFAULT_ROLES.map(role => {
      const sourcePermission = INHERITED_PERMISSION_SOURCES[permission];
      const inheritedGrant = sourcePermission
        ? sourceGrants.get(`${role.name}|||${sourcePermission}`)
        : undefined;
      return {
        role_name: role.name,
        permission,
        granted: inheritedGrant ?? DEFAULT_GRANTS[permission]?.[role.name] ?? false,
      };
    })
  );

  await queryable.query(
    `INSERT INTO permission_scheme_grants (scheme_id, role_name, permission, granted)
     SELECT $1, role_name, permission, granted
     FROM UNNEST($2::TEXT[], $3::TEXT[], $4::BOOLEAN[]) AS g(role_name, permission, granted)
     ON CONFLICT (scheme_id, role_name, permission) DO NOTHING`,
    [
      schemeId,
      grantRows.map(row => row.role_name),
      grantRows.map(row => row.permission),
      grantRows.map(row => row.granted),
    ]
  );
}

// Adds the given permissions to the scheme using the team's default scheme values
async function addPermissionsFromDefault(
  queryable: Queryable,
  teamId: string,
  schemeId: string,
  permissions: string[]
): Promise<void> {
  const defaultGrantsRes = await queryable.query(
    `SELECT psg.role_name, psg.permission, psg.granted
     FROM permission_scheme_grants psg
     JOIN permission_schemes ps ON ps.id = psg.scheme_id
     WHERE ps.team_id = $1 AND ps.is_default = TRUE AND psg.permission = ANY($2::TEXT[])`,
    [teamId, permissions]
  );

  const savedGrants = new Map<string, boolean>(
    defaultGrantsRes.rows.map(row => [`${row.role_name}|||${row.permission}`, row.granted as boolean])
  );

  const grantRows = permissions.flatMap(permission =>
    DEFAULT_ROLES.map(role => ({
      role_name: role.name,
      permission,
      granted:
        savedGrants.get(`${role.name}|||${permission}`) ??
        DEFAULT_GRANTS[permission]?.[role.name] ??
        false,
    }))
  );

  await queryable.query(
    `INSERT INTO permission_scheme_grants (scheme_id, role_name, permission, granted)
     SELECT $1, role_name, permission, granted
     FROM UNNEST($2::TEXT[], $3::TEXT[], $4::BOOLEAN[]) AS g(role_name, permission, granted)
     ON CONFLICT (scheme_id, role_name, permission)
     DO UPDATE SET granted = EXCLUDED.granted`,
    [
      schemeId,
      grantRows.map(row => row.role_name),
      grantRows.map(row => row.permission),
      grantRows.map(row => row.granted),
    ]
  );
}

function parsePermissionList(value: unknown, allowedPermissions: string[]): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const permissions = [...new Set(value)];
  if (permissions.some(permission => typeof permission !== 'string' || !allowedPermissions.includes(permission)))
    return null;
  return permissions as string[];
}

// Only custom (non-default, unlocked) schemes can have permissions added or removed
async function validateCustomSchemeAccess(
  schemeId: string,
  teamId: string
): Promise<{ status: number; message: string } | null> {
  const schemeRes = await db.query(
    'SELECT team_id, is_default, is_locked FROM permission_schemes WHERE id = $1',
    [schemeId]
  );
  if (schemeRes.rowCount === 0) return { status: 200, message: 'Scheme not found' };

  const row = schemeRes.rows[0];
  if (row.team_id !== teamId) return { status: 403, message: 'Forbidden' };
  if (row.is_default) return { status: 200, message: 'The default scheme permission list cannot be changed' };
  if (row.is_locked) return { status: 200, message: 'Scheme is locked and cannot be edited' };
  return null;
}

async function seedDefaultScheme(teamId: string): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const schemeRes = await client.query(
      `INSERT INTO permission_schemes (team_id, name, is_default, is_locked)
       VALUES ($1, 'Default', TRUE, FALSE)
       ON CONFLICT (team_id, name) DO NOTHING
       RETURNING id`,
      [teamId]
    );

    // If it was already seeded (ON CONFLICT), nothing to do
    if (schemeRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return;
    }

    await insertMissingDefaultGrants(client, schemeRes.rows[0].id as string);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export default class PermissionSchemesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getMyOrganizationPermissions(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const permissions = await getOrganizationPermissions(req.user);
    return res.status(200).send(new ServerResponse(true, permissions));
  }

  // -------------------------------------------------------------------------
  // Schemes
  // -------------------------------------------------------------------------

  @HandleExceptions()
  public static async getSchemes(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const defaultSchemeRes = await db.query(
      'SELECT id FROM permission_schemes WHERE team_id = $1 AND is_default = TRUE LIMIT 1',
      [teamId]
    );
    if (defaultSchemeRes.rowCount === 0) {
      await seedDefaultScheme(teamId);
    } else {
      // Backfills permissions added after the default scheme was first seeded
      await insertMissingDefaultGrants(db, defaultSchemeRes.rows[0].id as string);
    }

    const result = await db.query(
      `SELECT id, name, is_default, is_locked, created_at, updated_at
       FROM permission_schemes
       WHERE team_id = $1
       ORDER BY is_default DESC, created_at ASC`,
      [teamId]
    );

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async createScheme(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const name = (req.body?.name || '').trim();
    if (!name) return res.status(200).send(new ServerResponse(false, null, 'Scheme name is required'));

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const schemeRes = await client.query(
        `INSERT INTO permission_schemes (team_id, name, is_default, is_locked)
         VALUES ($1, $2, FALSE, FALSE)
         RETURNING id, name, is_default, is_locked, created_at, updated_at`,
        [teamId, name]
      );
      const scheme = schemeRes.rows[0];

      // Custom schemes start with roles only; permissions are added from the default list
      for (const role of DEFAULT_ROLES) {
        await client.query(
          `INSERT INTO permission_scheme_roles (scheme_id, role_name, sort_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (scheme_id, role_name) DO NOTHING`,
          [scheme.id, role.name, role.sort]
        );
      }

      await client.query('COMMIT');
      return res.status(200).send(new ServerResponse(true, scheme));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  @HandleExceptions()
  public static async getScheme(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { id } = req.params;

    const schemeRes = await db.query(
      'SELECT id, team_id, name, is_default, is_locked, created_at, updated_at FROM permission_schemes WHERE id = $1',
      [id]
    );
    if (schemeRes.rowCount === 0)
      return res.status(200).send(new ServerResponse(false, null, 'Scheme not found'));

    const scheme = schemeRes.rows[0];
    if (scheme.team_id !== teamId)
      return res.status(403).send(new ServerResponse(false, null, 'Forbidden'));

    const rolesRes = await db.query(
      'SELECT role_name, sort_order FROM permission_scheme_roles WHERE scheme_id = $1 ORDER BY sort_order ASC',
      [id]
    );

    const grantsRes = await db.query(
      'SELECT role_name, permission, granted FROM permission_scheme_grants WHERE scheme_id = $1',
      [id]
    );

    return res.status(200).send(
      new ServerResponse(true, {
        scheme,
        roles: rolesRes.rows,
        grants: grantsRes.rows,
      })
    );
  }

  @HandleExceptions()
  public static async updateScheme(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { id } = req.params;
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(200).send(new ServerResponse(false, null, 'Scheme name is required'));

    const schemeRes = await db.query(
      'SELECT team_id, is_locked FROM permission_schemes WHERE id = $1',
      [id]
    );
    if (schemeRes.rowCount === 0)
      return res.status(200).send(new ServerResponse(false, null, 'Scheme not found'));

    const row = schemeRes.rows[0];
    if (row.team_id !== teamId)
      return res.status(403).send(new ServerResponse(false, null, 'Forbidden'));
    if (row.is_locked)
      return res.status(200).send(new ServerResponse(false, null, 'Scheme is locked and cannot be edited'));

    const result = await db.query(
      `UPDATE permission_schemes
       SET name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, is_default, is_locked, created_at, updated_at`,
      [name, id]
    );

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async deleteScheme(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { id } = req.params;

    const schemeRes = await db.query(
      'SELECT team_id, is_default, is_locked FROM permission_schemes WHERE id = $1',
      [id]
    );
    if (schemeRes.rowCount === 0)
      return res.status(200).send(new ServerResponse(false, null, 'Scheme not found'));

    const row = schemeRes.rows[0];
    if (row.team_id !== teamId)
      return res.status(403).send(new ServerResponse(false, null, 'Forbidden'));
    if (row.is_default)
      return res.status(200).send(new ServerResponse(false, null, 'Cannot delete the default scheme'));
    if (row.is_locked)
      return res.status(200).send(new ServerResponse(false, null, 'Scheme is locked and cannot be deleted'));

    await db.query('DELETE FROM permission_schemes WHERE id = $1', [id]);

    return res.status(200).send(new ServerResponse(true, null));
  }

  @HandleExceptions()
  public static async updateGrants(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { id } = req.params;
    const grants: IGrantUpdate[] = req.body?.grants ?? [];

    if (!Array.isArray(grants) || grants.length === 0)
      return res.status(200).send(new ServerResponse(false, null, 'No grants provided'));

    const schemeRes = await db.query(
      'SELECT team_id, is_default, is_locked FROM permission_schemes WHERE id = $1',
      [id]
    );
    if (schemeRes.rowCount === 0)
      return res.status(200).send(new ServerResponse(false, null, 'Scheme not found'));

    const row = schemeRes.rows[0];
    if (row.team_id !== teamId)
      return res.status(403).send(new ServerResponse(false, null, 'Forbidden'));
    if (row.is_locked)
      return res.status(200).send(new ServerResponse(false, null, 'Scheme is locked and cannot be edited'));

    const allowedPermissions = row.is_default ? DEFAULT_PERMISSIONS : PROJECT_PERMISSIONS;
    if (grants.some(grant => !allowedPermissions.includes(grant.permission)))
      return res.status(200).send(new ServerResponse(false, null, 'Invalid permission for this scheme'));

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const grant of grants) {
        await client.query(
          `INSERT INTO permission_scheme_grants (scheme_id, role_name, permission, granted)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (scheme_id, role_name, permission)
           DO UPDATE SET granted = EXCLUDED.granted`,
          [id, grant.role_name, grant.permission, grant.granted]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updatedGrants = await db.query(
      'SELECT role_name, permission, granted FROM permission_scheme_grants WHERE scheme_id = $1',
      [id]
    );

    return res.status(200).send(new ServerResponse(true, updatedGrants.rows));
  }

  @HandleExceptions()
  public static async addSchemePermissions(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { id } = req.params;
    // Custom schemes only apply per project, so they hold project permissions only
    const permissions = parsePermissionList(req.body?.permissions, PROJECT_PERMISSIONS);
    if (!permissions)
      return res.status(200).send(new ServerResponse(false, null, 'Invalid permissions'));

    const error = await validateCustomSchemeAccess(id, teamId);
    if (error) return res.status(error.status).send(new ServerResponse(false, null, error.message));

    await addPermissionsFromDefault(db, teamId, id, permissions);

    const updatedGrants = await db.query(
      'SELECT role_name, permission, granted FROM permission_scheme_grants WHERE scheme_id = $1',
      [id]
    );

    return res.status(200).send(new ServerResponse(true, updatedGrants.rows));
  }

  @HandleExceptions()
  public static async removeSchemePermissions(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { id } = req.params;
    const permissions = parsePermissionList(req.body?.permissions, DEFAULT_PERMISSIONS);
    if (!permissions)
      return res.status(200).send(new ServerResponse(false, null, 'Invalid permissions'));

    const error = await validateCustomSchemeAccess(id, teamId);
    if (error) return res.status(error.status).send(new ServerResponse(false, null, error.message));

    await db.query(
      'DELETE FROM permission_scheme_grants WHERE scheme_id = $1 AND permission = ANY($2::TEXT[])',
      [id, permissions]
    );

    const updatedGrants = await db.query(
      'SELECT role_name, permission, granted FROM permission_scheme_grants WHERE scheme_id = $1',
      [id]
    );

    return res.status(200).send(new ServerResponse(true, updatedGrants.rows));
  }

  // -------------------------------------------------------------------------
  // Groups
  // -------------------------------------------------------------------------

  @HandleExceptions()
  public static async getGroups(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const result = await db.query(
      `SELECT pg.id, pg.name, pg.created_at,
              COUNT(pgm.id)::INT AS member_count
       FROM permission_groups pg
       LEFT JOIN permission_group_members pgm ON pgm.group_id = pg.id
       WHERE pg.team_id = $1
       GROUP BY pg.id
       ORDER BY pg.created_at ASC`,
      [teamId]
    );

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async createGroup(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const name = (req.body?.name || '').trim();
    if (!name) return res.status(200).send(new ServerResponse(false, null, 'Group name is required'));

    const result = await db.query(
      `INSERT INTO permission_groups (team_id, name)
       VALUES ($1, $2)
       RETURNING id, name, created_at`,
      [teamId, name]
    );

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async updateGroup(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { id } = req.params;
    const name = (req.body?.name || '').trim();
    const memberIds: string[] = Array.isArray(req.body?.member_ids) ? req.body.member_ids : [];

    const groupRes = await db.query(
      'SELECT team_id FROM permission_groups WHERE id = $1',
      [id]
    );
    if (groupRes.rowCount === 0)
      return res.status(200).send(new ServerResponse(false, null, 'Group not found'));
    if (groupRes.rows[0].team_id !== teamId)
      return res.status(403).send(new ServerResponse(false, null, 'Forbidden'));

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      if (name) {
        await client.query(
          'UPDATE permission_groups SET name = $1 WHERE id = $2',
          [name, id]
        );
      }

      if (memberIds.length > 0) {
        // Replace members: delete old, insert new
        await client.query('DELETE FROM permission_group_members WHERE group_id = $1', [id]);
        for (const memberId of memberIds) {
          await client.query(
            `INSERT INTO permission_group_members (group_id, team_member_id)
             VALUES ($1, $2)
             ON CONFLICT (group_id, team_member_id) DO NOTHING`,
            [id, memberId]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const result = await db.query(
      `SELECT pg.id, pg.name, pg.created_at, COUNT(pgm.id)::INT AS member_count
       FROM permission_groups pg
       LEFT JOIN permission_group_members pgm ON pgm.group_id = pg.id
       WHERE pg.id = $1
       GROUP BY pg.id`,
      [id]
    );

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async deleteGroup(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { id } = req.params;

    const groupRes = await db.query(
      'SELECT team_id FROM permission_groups WHERE id = $1',
      [id]
    );
    if (groupRes.rowCount === 0)
      return res.status(200).send(new ServerResponse(false, null, 'Group not found'));
    if (groupRes.rows[0].team_id !== teamId)
      return res.status(403).send(new ServerResponse(false, null, 'Forbidden'));

    await db.query('DELETE FROM permission_groups WHERE id = $1', [id]);

    return res.status(200).send(new ServerResponse(true, null));
  }

  // -------------------------------------------------------------------------
  // Project scheme assignments
  // -------------------------------------------------------------------------

  @HandleExceptions()
  public static async getTeamProjectSchemes(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const result = await db.query(
      `SELECT p.id, p.name, psa.scheme_id
       FROM projects p
       LEFT JOIN project_scheme_assignments psa ON psa.project_id = p.id
       WHERE p.team_id = $1
       ORDER BY p.name ASC`,
      [teamId]
    );

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getProjectScheme(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { projectId } = req.params;

    const result = await db.query(
      `SELECT psa.project_id,
              psa.scheme_id,
              ps.name          AS scheme_name,
              ps.is_default    AS scheme_is_default,
              ps.is_locked     AS scheme_is_locked
       FROM project_scheme_assignments psa
       LEFT JOIN permission_schemes ps ON ps.id = psa.scheme_id
       WHERE psa.project_id = $1`,
      [projectId]
    );

    if (result.rowCount === 0) {
      return res.status(200).send(new ServerResponse(true, { project_id: projectId, scheme_id: null }));
    }

    const row = result.rows[0];
    const payload: Record<string, unknown> = {
      project_id: row.project_id,
      scheme_id: row.scheme_id,
    };

    if (row.scheme_id) {
      payload.scheme = {
        id: row.scheme_id,
        name: row.scheme_name,
        is_default: row.scheme_is_default,
        is_locked: row.scheme_is_locked,
      };

      const grantsRes = await db.query(
        'SELECT role_name, permission, granted FROM permission_scheme_grants WHERE scheme_id = $1',
        [row.scheme_id]
      );
      payload.grants = grantsRes.rows;

      const membersRes = await db.query(
        `SELECT srm.id, srm.role_name, srm.team_member_id, srm.group_id
         FROM scheme_role_members srm
         WHERE srm.project_id = $1 AND srm.scheme_id = $2`,
        [projectId, row.scheme_id]
      );
      payload.role_members = membersRes.rows;
    }

    return res.status(200).send(new ServerResponse(true, payload));
  }

  @HandleExceptions()
  public static async assignProjectScheme(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { projectId } = req.params;
    const schemeId: string | null = req.body?.scheme_id ?? null;

    const result = await db.query(
      `INSERT INTO project_scheme_assignments (project_id, scheme_id)
       VALUES ($1, $2)
       ON CONFLICT (project_id)
       DO UPDATE SET scheme_id = EXCLUDED.scheme_id
       RETURNING project_id, scheme_id`,
      [projectId, schemeId]
    );

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async addSchemeMember(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { projectId } = req.params;
    const { scheme_id, role_name, team_member_id, group_id } = req.body || {};

    if (!scheme_id || !role_name)
      return res.status(200).send(new ServerResponse(false, null, 'scheme_id and role_name are required'));
    if ((!team_member_id && !group_id) || (team_member_id && group_id))
      return res.status(200).send(
        new ServerResponse(false, null, 'Exactly one of team_member_id or group_id is required')
      );

    const result = await db.query(
      `INSERT INTO scheme_role_members (project_id, scheme_id, role_name, team_member_id, group_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, role_name, team_member_id, group_id`,
      [projectId, scheme_id, role_name, team_member_id ?? null, group_id ?? null]
    );

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async removeSchemeMember(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(200).send(new ServerResponse(false, null, 'Team not found'));

    const { memberId } = req.params;

    // Verify the row belongs to the current team before deleting
    const checkRes = await db.query(
      `SELECT srm.id
       FROM scheme_role_members srm
       JOIN permission_schemes ps ON ps.id = srm.scheme_id
       WHERE srm.id = $1 AND ps.team_id = $2`,
      [memberId, teamId]
    );

    if (checkRes.rowCount === 0)
      return res.status(403).send(new ServerResponse(false, null, 'Forbidden'));

    await db.query('DELETE FROM scheme_role_members WHERE id = $1', [memberId]);

    return res.status(200).send(new ServerResponse(true, null));
  }
}
