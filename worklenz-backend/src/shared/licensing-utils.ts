import db from "../config/db";

/**
 * Generic licensing / usage queries shared by core controllers.
 *
 * These are edition-neutral data lookups (member counts, project counts, storage usage, and the
 * free-tier limits stored in `licensing_settings`). They contain no billing-provider logic, so
 * they live in core. Paddle/subscription-specific logic stays in `paddle-utils.ts` (EE).
 */

export async function getTeamMemberCount(userId: string) {
  if (!userId) return;

  const q = `SELECT (COUNT(*)::INT) AS user_count,
       (SELECT SUM(team_members_limit)::INT FROM licensing_coupon_codes WHERE redeemed_by = $1) AS free_count,
       (SELECT email FROM users WHERE id = $1) AS email
        FROM (SELECT DISTINCT email
            FROM team_member_info_view tmiv
            WHERE tmiv.team_id IN
                    (SELECT id
                    FROM teams
                    WHERE teams.user_id = $1)) AS total`;
  const result = await db.query(q, [userId]);
  const [data] = result.rows;
  data.user_count = data.user_count - data.free_count;
  return data;
}

export async function getActiveTeamMemberCount(userId: string) {
  if (!userId) return;

  const q = `SELECT (COUNT(*)::INT) AS user_count,
                    (SELECT SUM(team_members_limit)::INT FROM licensing_coupon_codes WHERE redeemed_by = $1) AS free_count,
                    (SELECT email FROM users WHERE id = $1) AS email
              FROM (
                SELECT DISTINCT tmiv.email FROM team_member_info_view tmiv
                  JOIN teams t ON tmiv.team_id = t.id
                  JOIN team_members tm ON tmiv.team_member_id = tm.id
                WHERE t.user_id = $1 AND tm.active is true
              ) AS total;`;
  const result = await db.query(q, [userId]);
  const [data] = result.rows;
  data.user_count = data.user_count - data.free_count;
  return data;
}

export async function getFreePlanSettings() {
  const q = `
    SELECT projects_limit, team_member_limit, free_tier_storage
    FROM licensing_settings;`;
  const result = await db.query(q);
  const [data] = result.rows;
  return data;
}

export async function getOwnerIdByTeam(teamId: string) {
  const owner_id_q = `SELECT user_id FROM teams WHERE id = $1;`;
  const result = await db.query(owner_id_q, [teamId]);
  const [data] = result.rows;

  return data?.user_id;
}

export async function getCurrentProjectsCount(owner_id: string) {
  const projects_counts_q = `SELECT COUNT(*)
    FROM projects
    WHERE team_id IN (SELECT id FROM teams WHERE owner_id = $1);`;
  const result = await db.query(projects_counts_q, [owner_id]);
  const [data] = result.rows;

  return data?.count;
}

export async function getUsedStorage(owner_id: string) {
  const storage_q = `SELECT (COALESCE(SUM(size), 0)) AS used_storage
    FROM task_attachments
    WHERE team_id IN (SELECT id FROM teams WHERE user_id = $1);`;
  const result = await db.query(storage_q, [owner_id]);
  const [data] = result.rows;

  return data?.used_storage;
}
