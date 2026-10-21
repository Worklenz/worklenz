import db from "../../config/db";
import { withTransaction } from "../client-contacts-service";
import { AuditActor, recordAuditEvent } from "./audit.service";
import { badRequest, notFound } from "./errors";
import { cleanPortalRichText } from "./rich-text";
import { notifyClientUsers } from "./notify.service";
import { getMilestoneSource, listPhaseMilestones } from "./milestone-source";
import { getProjectRef } from "./project-core";
import { fileClientVisibleSql, taskClientVisibleSql } from "./scope";
import { PortalVisibility, Queryable, isPortalVisibility } from "./types";

export const MILESTONE_STATUSES = ["upcoming", "in_progress", "completed", "delayed"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export interface MilestoneView {
  id: string;
  project_id: string;
  name: string;
  description: string;
  target_date: string;
  completed_at: string | null;
  status: MilestoneStatus;
  visibility: PortalVisibility;
  completion_note: string;
  /** Never shown to the client, not even for a Delayed milestone. */
  internal_note: string;
  linked: { task_ids: string[]; file_ids: string[] };
  /** Staff-only: how many linked items the client can actually see. */
  linked_visible_count: number;
  linked_total_count: number;
  /** True for a WorkLenz phase shown as a milestone: it cannot be edited, shared or deleted here. */
  read_only: boolean;
}

const MILESTONE_SELECT = `
  SELECT m.id, m.project_id, m.name, m.description, m.target_date::text AS target_date,
         m.completed_at::text AS completed_at, m.status, m.visibility,
         m.completion_note, m.internal_note,
         COALESCE((SELECT array_agg(l.task_id) FROM client_portal_milestone_links l
                    WHERE l.milestone_id = m.id AND l.task_id IS NOT NULL), '{}') AS task_ids,
         COALESCE((SELECT array_agg(l.file_id) FROM client_portal_milestone_links l
                    WHERE l.milestone_id = m.id AND l.file_id IS NOT NULL), '{}') AS file_ids,
         (SELECT COUNT(*)::int
            FROM client_portal_milestone_links l
            LEFT JOIN tasks t ON t.id = l.task_id
            LEFT JOIN project_files pf ON pf.id = l.file_id
           WHERE l.milestone_id = m.id
             AND ((l.task_id IS NOT NULL AND ${taskClientVisibleSql("t")})
               OR (l.file_id IS NOT NULL AND ${fileClientVisibleSql("pf")}))) AS linked_visible_count,
         (SELECT COUNT(*)::int FROM client_portal_milestone_links l WHERE l.milestone_id = m.id) AS linked_total_count
    FROM client_portal_milestones m
`;

const toView = (row: any): MilestoneView => ({
  id: row.id,
  project_id: row.project_id,
  name: row.name,
  description: row.description,
  target_date: row.target_date,
  completed_at: row.completed_at ?? null,
  status: row.status,
  visibility: row.visibility,
  completion_note: row.completion_note,
  internal_note: row.internal_note,
  linked: { task_ids: row.task_ids ?? [], file_ids: row.file_ids ?? [] },
  linked_visible_count: row.linked_visible_count ?? 0,
  linked_total_count: row.linked_total_count ?? 0,
  read_only: false,
});

export async function listMilestones(q: Queryable, teamId: string, projectId: string): Promise<MilestoneView[]> {
  await getProjectRef(q, teamId, projectId);

  // On WorkLenz milestones the list is the project's phases with their real dates, read-only.
  if ((await getMilestoneSource(q, projectId)) === "worklenz") {
    const phases = await listPhaseMilestones(q, projectId);
    return phases.map(phase => ({
      id: phase.id,
      project_id: phase.project_id,
      name: phase.name,
      description: "",
      target_date: phase.target_date,
      completed_at: phase.completed_at,
      status: phase.status,
      visibility: "client" as PortalVisibility,
      completion_note: "",
      internal_note: "",
      linked: { task_ids: [], file_ids: [] },
      linked_visible_count: 0,
      linked_total_count: 0,
      read_only: true,
    }));
  }

  const result = await q.query(
    `${MILESTONE_SELECT} WHERE m.project_id = $1 AND m.team_id = $2 ORDER BY m.target_date, m.created_at`,
    [projectId, teamId]
  );
  return result.rows.map(toView);
}

async function getMilestone(q: Queryable, teamId: string, milestoneId: string): Promise<MilestoneView> {
  const result = await q.query(`${MILESTONE_SELECT} WHERE m.id = $1 AND m.team_id = $2`, [milestoneId, teamId]);
  if (result.rows.length === 0) throw notFound("Milestone");
  return toView(result.rows[0]);
}

const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Replaces a milestone's linked work. Every task and file must belong to the milestone's project. */
async function replaceLinks(
  q: Queryable,
  projectId: string,
  milestoneId: string,
  linked: { task_ids?: string[]; file_ids?: string[] }
): Promise<void> {
  const taskIds = Array.from(new Set(linked.task_ids ?? []));
  const fileIds = Array.from(new Set(linked.file_ids ?? []));

  if (taskIds.length > 0) {
    const valid = await q.query(`SELECT id FROM tasks WHERE id = ANY($1::uuid[]) AND project_id = $2`, [
      taskIds,
      projectId,
    ]);
    if (valid.rows.length !== taskIds.length) throw badRequest("A linked task is not in this project", "INVALID_LINK");
  }
  if (fileIds.length > 0) {
    const valid = await q.query(
      `SELECT id FROM project_files WHERE id = ANY($1::uuid[]) AND project_id = $2 AND status = 'active'`,
      [fileIds, projectId]
    );
    if (valid.rows.length !== fileIds.length) throw badRequest("A linked file is not in this project", "INVALID_LINK");
  }

  await q.query(`DELETE FROM client_portal_milestone_links WHERE milestone_id = $1`, [milestoneId]);
  if (taskIds.length > 0) {
    await q.query(
      `INSERT INTO client_portal_milestone_links (milestone_id, task_id)
       SELECT $1, unnest($2::uuid[])`,
      [milestoneId, taskIds]
    );
  }
  if (fileIds.length > 0) {
    await q.query(
      `INSERT INTO client_portal_milestone_links (milestone_id, file_id)
       SELECT $1, unnest($2::uuid[])`,
      [milestoneId, fileIds]
    );
  }
}

export interface MilestoneInput {
  name?: string;
  description?: string;
  target_date?: string;
  status?: string;
  visibility?: string;
  internal_note?: string;
  linked?: { task_ids?: string[]; file_ids?: string[] };
}

const visibilityEvent = (visibility: PortalVisibility) =>
  visibility === "client" ? ("Entity made Client Visible" as const) : ("Entity returned to Internal Only" as const);

async function auditVisibility(
  q: Queryable,
  input: { teamId: string; actor: AuditActor; projectId: string; milestone: { id: string; name: string }; visibility: PortalVisibility }
): Promise<void> {
  const project = await getProjectRef(q, input.teamId, input.projectId);
  await recordAuditEvent(q, {
    teamId: input.teamId,
    event: visibilityEvent(input.visibility),
    actor: input.actor,
    clientId: project.clientId,
    clientName: project.clientName,
    projectId: project.id,
    targetType: "milestone",
    targetId: input.milestone.id,
    targetLabel: `Milestone: ${input.milestone.name}`,
  });
}

/** Creates a milestone. It needs a name and a target date, and is Internal Only unless shared. */
export async function createMilestone(input: {
  teamId: string;
  projectId: string;
  userId: string;
  actor: AuditActor;
  body: MilestoneInput;
}): Promise<MilestoneView> {
  const { teamId, projectId, body } = input;
  if ((await getMilestoneSource(db, projectId)) === "worklenz") {
    throw badRequest("This project shows its WorkLenz phases. Switch to manual milestones to add your own.", "MILESTONE_SOURCE");
  }
  const name = (body.name ?? "").trim();
  if (!name) throw badRequest("A milestone needs a name", "MISSING_FIELDS");
  if (name.length > 120) throw badRequest("A milestone name can be at most 120 characters");
  if (!isIsoDate(body.target_date)) throw badRequest("A milestone needs a target date", "MISSING_FIELDS");

  const status = body.status ?? "upcoming";
  if (!(MILESTONE_STATUSES as readonly string[]).includes(status)) throw badRequest("Invalid milestone status");
  const visibility = body.visibility ?? "internal";
  if (!isPortalVisibility(visibility)) throw badRequest("Invalid visibility");

  const id = await withTransaction(async tx => {
    await getProjectRef(tx, teamId, projectId);

    const inserted = await tx.query(
      `INSERT INTO client_portal_milestones
         (team_id, project_id, name, description, target_date, completed_at, status, visibility, internal_note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        teamId,
        projectId,
        name,
        cleanPortalRichText(body.description, 2000, "The description"),
        body.target_date,
        status === "completed" ? new Date().toISOString().slice(0, 10) : null,
        status,
        visibility,
        cleanPortalRichText(body.internal_note, 2000, "The internal note"),
        input.userId,
      ]
    );
    const milestoneId = inserted.rows[0].id as string;
    if (body.linked) await replaceLinks(tx, projectId, milestoneId, body.linked);

    // Creating a milestone as Client Visible shares it, which is audited like any other share.
    if (visibility === "client") {
      await auditVisibility(tx, { teamId, actor: input.actor, projectId, milestone: { id: milestoneId, name }, visibility });
    }
    return milestoneId;
  });

  return getMilestone(db, teamId, id);
}

/**
 * Edits a milestone. A visibility change is audited. Setting Delayed tells the client only the new
 * date; the internal note is never part of any client payload. Moving a Completed milestone back to
 * another status clears its completion date (the prototype's behaviour; the spec leaves it open).
 */
export async function updateMilestone(input: {
  teamId: string;
  milestoneId: string;
  actor: AuditActor;
  body: MilestoneInput;
}): Promise<MilestoneView> {
  const { teamId, milestoneId, body } = input;

  await withTransaction(async tx => {
    const current = await getMilestone(tx, teamId, milestoneId);
    const sets: string[] = [];
    const values: unknown[] = [milestoneId, teamId];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) throw badRequest("A milestone needs a name", "MISSING_FIELDS");
      if (name.length > 120) throw badRequest("A milestone name can be at most 120 characters");
      set("name", name);
    }
    if (body.description !== undefined) set("description", cleanPortalRichText(body.description, 2000, "The description"));
    if (body.target_date !== undefined) {
      if (!isIsoDate(body.target_date)) throw badRequest("A milestone needs a target date", "MISSING_FIELDS");
      set("target_date", body.target_date);
    }
    if (body.internal_note !== undefined) set("internal_note", cleanPortalRichText(body.internal_note, 2000, "The internal note"));

    if (body.status !== undefined && body.status !== current.status) {
      if (!(MILESTONE_STATUSES as readonly string[]).includes(body.status)) throw badRequest("Invalid milestone status");
      set("status", body.status);
      if (body.status === "completed") set("completed_at", new Date().toISOString().slice(0, 10));
      else if (current.status === "completed") set("completed_at", null);
    }

    let visibilityChanged: PortalVisibility | null = null;
    if (body.visibility !== undefined && body.visibility !== current.visibility) {
      if (!isPortalVisibility(body.visibility)) throw badRequest("Invalid visibility");
      set("visibility", body.visibility);
      visibilityChanged = body.visibility;
    }

    if (sets.length > 0) {
      await tx.query(
        `UPDATE client_portal_milestones SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND team_id = $2`,
        values
      );
    }
    if (body.linked) await replaceLinks(tx, current.project_id, milestoneId, body.linked);

    if (visibilityChanged) {
      await auditVisibility(tx, {
        teamId,
        actor: input.actor,
        projectId: current.project_id,
        milestone: { id: milestoneId, name: body.name?.trim() || current.name },
        visibility: visibilityChanged,
      });
    }
  });

  return getMilestone(db, teamId, milestoneId);
}

/**
 * Marks a milestone complete: the target date is kept, today is recorded as the completion date and
 * an optional completion note is stored. A Client Visible milestone notifies the client and shows
 * the note; an Internal Only one reaches no one.
 */
export async function completeMilestone(input: {
  teamId: string;
  milestoneId: string;
  completionNote?: string;
}): Promise<MilestoneView> {
  const { teamId, milestoneId } = input;
  const current = await getMilestone(db, teamId, milestoneId);

  await db.query(
    `UPDATE client_portal_milestones
        SET status = 'completed', completed_at = CURRENT_DATE,
            completion_note = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND team_id = $2`,
    [milestoneId, teamId, cleanPortalRichText(input.completionNote, 2000, "The completion note")]
  );

  if (current.visibility === "client") {
    const project = await getProjectRef(db, teamId, current.project_id);
    if (project.clientId) {
      void notifyClientUsers({
        teamId,
        clientId: project.clientId,
        projectId: project.id,
        type: "milestone",
        title: `Milestone completed: ${current.name}`,
        message: input.completionNote?.trim() || `${current.name} is complete.`,
        referenceId: milestoneId,
        emailEvent: "milestone_change",
        portalPath: `/projects/${project.id}`,
      });
    }
  }

  return getMilestone(db, teamId, milestoneId);
}

/** Deletes a milestone and its links. The spec asks for a confirmation (UI) and an audit event. */
export async function deleteMilestone(input: {
  teamId: string;
  milestoneId: string;
  actor: AuditActor;
}): Promise<void> {
  await withTransaction(async tx => {
    const current = await getMilestone(tx, input.teamId, input.milestoneId);
    const project = await getProjectRef(tx, input.teamId, current.project_id);
    await tx.query(`DELETE FROM client_portal_milestones WHERE id = $1 AND team_id = $2`, [
      input.milestoneId,
      input.teamId,
    ]);
    await recordAuditEvent(tx, {
      teamId: input.teamId,
      event: "Milestone deleted",
      actor: input.actor,
      clientId: project.clientId,
      clientName: project.clientName,
      projectId: project.id,
      targetType: "milestone",
      targetId: input.milestoneId,
      targetLabel: `Milestone: ${current.name}`,
    });
  });
}
