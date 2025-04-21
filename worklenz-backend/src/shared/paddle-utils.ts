import db from "../config/db";
import { log_error } from "./utils";

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

export async function checkTeamSubscriptionStatus(team_id: string) {
  try {
    const q = `SELECT trial_expire_date,
                      subscription_status,
                      subscription_id,
                      quantity::INT,
                      (SELECT key FROM sys_license_types WHERE id = ud.license_type_id) AS subscription_type,
                      (SELECT EXISTS(SELECT id FROM licensing_custom_subs lcs WHERE lcs.user_id = ud.user_id)) AS is_custom,
                      (SELECT EXISTS(SELECT id FROM licensing_credit_subs lcs WHERE lcs.user_id = ud.user_id)) AS is_credit,
                      (SELECT EXISTS(SELECT id FROM licensing_coupon_codes WHERE redeemed_by = ud.user_id)) AS is_ltd,
                      (SELECT SUM(team_members_limit) FROM licensing_coupon_codes WHERE redeemed_by = ud.user_id) AS ltd_users,
                      (SELECT COUNT(DISTINCT email)
                        FROM team_member_info_view tmiv
                        WHERE tmiv.team_id IN
                              (SELECT id
                              FROM teams
                              WHERE teams.user_id = ud.user_id)) AS current_count
                    FROM organizations ud
                LEFT JOIN licensing_user_subscriptions lus ON lus.user_id = ud.user_id
        WHERE ud.user_id = (SELECT user_id FROM teams WHERE id = $1);`;
    const result = await db.query(q, [team_id]);
    const [data] = result.rows;
    return data;
  } catch (error) {
    log_error(error);
    return;
  }
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
