import { getColor } from "../../shared/utils";
import { Queryable } from "./types";

/** A staff member as the admin console shows them. The id is the team member id. */
export interface StaffRef {
  id: string;
  name: string;
  short_name: string;
  initials: string;
  color: string;
}

const shortNameOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0] ?? "")
    .join("")
    .toUpperCase() || "?";

export const toStaffRef = (teamMemberId: string, name: string): StaffRef => ({
  id: teamMemberId,
  name,
  short_name: shortNameOf(name),
  initials: initialsOf(name),
  color: getColor(name),
});

/** Active members of the workspace, for pickers (primary contact, change request assignee). */
export async function listStaff(q: Queryable, teamId: string): Promise<StaffRef[]> {
  const result = await q.query(
    `SELECT tm.id, u.name
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = $1 AND tm.active IS TRUE AND COALESCE(tm.is_guest, FALSE) IS FALSE
      ORDER BY u.name`,
    [teamId]
  );
  return result.rows.map(row => toStaffRef(row.id, row.name));
}

/** Resolves one active workspace member, or null. Used to validate an assignee / contact id. */
export async function findStaff(q: Queryable, teamId: string, teamMemberId: string): Promise<StaffRef | null> {
  const result = await q.query(
    `SELECT tm.id, u.name
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
      WHERE tm.id = $1 AND tm.team_id = $2 AND tm.active IS TRUE`,
    [teamMemberId, teamId]
  );
  const row = result.rows[0];
  return row ? toStaffRef(row.id, row.name) : null;
}
