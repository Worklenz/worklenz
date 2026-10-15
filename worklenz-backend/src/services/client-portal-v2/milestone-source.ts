import { Queryable } from "./types";

/** Where a project's milestones come from: its WorkLenz phases, or the ones staff add by hand. */
export type MilestoneSource = "worklenz" | "manual";

export const isMilestoneSource = (value: unknown): value is MilestoneSource =>
  value === "worklenz" || value === "manual";

// A phase is a milestone dated by its end (or, failing that, its start). A phase with no dates at
// all is left out rather than given an invented date. The status follows the dates.
const PHASE_DATE_SQL = `COALESCE(ph.end_date, ph.start_date)::date`;
const PHASE_STATUS_SQL = `CASE
    WHEN ph.start_date IS NOT NULL AND ph.start_date::date > CURRENT_DATE THEN 'upcoming'
    WHEN ${PHASE_DATE_SQL} < CURRENT_DATE THEN 'completed'
    ELSE 'in_progress' END`;

/**
 * Every project's current milestones as one list, whichever source the project uses. `id` is text
 * (a phase's id is prefixed `phase-`). Phase rows are always Client Visible and read-only.
 */
export const EFFECTIVE_MILESTONES_SQL = `(
  SELECT m.id::text AS id, m.project_id, m.name, m.target_date, m.status, m.visibility, m.created_at
    FROM client_portal_milestones m
    JOIN project_client_settings s ON s.project_id = m.project_id AND s.milestone_source = 'manual'
  UNION ALL
  SELECT 'phase-' || ph.id::text, ph.project_id, ph.name, ${PHASE_DATE_SQL}, ${PHASE_STATUS_SQL}, 'client', ph.created_at
    FROM project_phases ph
    JOIN project_client_settings s ON s.project_id = ph.project_id AND s.milestone_source = 'worklenz'
   WHERE COALESCE(ph.end_date, ph.start_date) IS NOT NULL
)`;

export async function getMilestoneSource(q: Queryable, projectId: string): Promise<MilestoneSource> {
  const result = await q.query(`SELECT milestone_source FROM project_client_settings WHERE project_id = $1`, [projectId]);
  return result.rows[0]?.milestone_source === "worklenz" ? "worklenz" : "manual";
}

export interface PhaseMilestoneRow {
  id: string;
  project_id: string;
  name: string;
  target_date: string;
  completed_at: string | null;
  status: "upcoming" | "in_progress" | "completed";
}

/** The project's phases shaped as milestones, earliest first. */
export async function listPhaseMilestones(q: Queryable, projectId: string): Promise<PhaseMilestoneRow[]> {
  const result = await q.query(
    `SELECT 'phase-' || ph.id::text AS id, ph.project_id, ph.name,
            ${PHASE_DATE_SQL}::text AS target_date,
            ${PHASE_STATUS_SQL} AS status,
            CASE WHEN ${PHASE_STATUS_SQL} = 'completed' THEN ${PHASE_DATE_SQL}::text END AS completed_at
       FROM project_phases ph
      WHERE ph.project_id = $1 AND COALESCE(ph.end_date, ph.start_date) IS NOT NULL
      ORDER BY ${PHASE_DATE_SQL}, ph.sort_index, ph.created_at`,
    [projectId]
  );
  return result.rows;
}
