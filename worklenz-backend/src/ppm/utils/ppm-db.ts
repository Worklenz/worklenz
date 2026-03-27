import db from "../../config/db";

/**
 * Acquire a connection, set RLS context + role, run callback, commit/rollback.
 * SET ROLE ppm_client_role ensures RLS policies are actually enforced
 * (table owner bypasses RLS by default). RESET ROLE restores the original role.
 */
export async function withClientScope<T>(clientId: string, fn: (conn: any) => Promise<T>): Promise<T> {
  const conn = await db.pool.connect();
  try {
    await conn.query("BEGIN");
    await conn.query("SELECT set_config('ppm.current_client_id', $1, true)", [clientId]);
    await conn.query("SET ROLE ppm_client_role");
    const result = await fn(conn);
    await conn.query("RESET ROLE");
    await conn.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await conn.query("RESET ROLE");
      await conn.query("ROLLBACK");
    } catch {
      // Connection may be broken — DISCARD ALL as last resort before release
      try { await conn.query("DISCARD ALL"); } catch { /* connection is dead, release will handle */ }
    }
    throw error;
  } finally {
    // Defensive: ensure role is always reset before returning connection to pool
    try { await conn.query("RESET ROLE"); } catch { /* already reset or connection dead */ }
    conn.release();
  }
}

/**
 * Get the primary project for a client.
 * Returns { project_id, incoming_status_id } or null if no primary project linked.
 */
export async function getClientPrimaryProject(clientId: string): Promise<{ project_id: string; incoming_status_id: string } | null> {
  const result = await db.pool.query(
    `SELECT project_id, incoming_status_id
     FROM ppm_client_projects
     WHERE client_id = $1 AND is_primary = true
     LIMIT 1`,
    [clientId]
  );
  return result.rows[0] || null;
}

// Cached system user ID (loaded once on first call)
let _systemUserId: string | null = null;

/**
 * Get the PPM Portal System user ID (used as reporter_id for portal-created tasks).
 * Cached in memory after first lookup.
 */
export async function getPPMSystemUser(): Promise<string> {
  if (_systemUserId) return _systemUserId;

  const result = await db.pool.query(
    `SELECT id FROM users WHERE email = 'system@ppm-portal.internal' LIMIT 1`
  );

  if (!result.rows[0]) {
    throw new Error("PPM Portal System user not found — run migration 014");
  }

  const id: string = result.rows[0].id;
  _systemUserId = id;
  return id;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
