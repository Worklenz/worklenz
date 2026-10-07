import {PoolClient} from "pg";

import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {isValidUuid} from "../shared/validation-helpers";
import {advanceBacklogIssuesToTodo} from "../shared/software-sprint-utils";
import {NotificationsService} from "../services/notifications/notifications.service";

type IssueType = "task" | "story" | "bug" | "subtask";

const isUuid = (value: unknown): value is string => typeof value === "string" && isValidUuid(value);

interface ICreateIssueInput {
  projectId: string;
  name: string;
  description: string | null;
  issueType: IssueType;
  assigneeId: string | null;
  epicId: string | null;
  storyPoints: number | null;
  phaseId: string | null;
  statusId: string | null;
  parentTaskId: string | null;
}

export default class SoftwareIssuesController extends WorklenzControllerBase {
  private static readonly NAME_MAX_LENGTH = 250;
  private static readonly DESCRIPTION_MAX_LENGTH = 5000;
  private static readonly MAX_POINT_VALUE = 1000;
  private static readonly ISSUE_TYPES: IssueType[] = ["task", "story", "bug", "subtask"];

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const input = this.parseInput(req.body);
    if (typeof input === "string") {
      return res.status(400).send(new ServerResponse(false, null, input));
    }

    const userId = req.user?.id as string;
    const teamId = req.user?.team_id as string;

    const restricted = await db.query(
      "SELECT is_task_creation_restricted($1, $2) AS restricted;",
      [userId, input.projectId]
    );
    if (restricted.rows[0]?.restricted === true) {
      return res.status(403).send(
        new ServerResponse(false, null, "Task creation is restricted. Please contact admin for access.")
      );
    }

    const client = await db.pool.connect();
    let taskId: string;
    let assignees: { user_id: string; team_id: string }[] = [];
    try {
      await client.query("BEGIN");

      const referenceError = await this.validateReferences(client, input, teamId);
      if (referenceError) {
        await client.query("ROLLBACK");
        return res.status(400).send(new ServerResponse(false, null, referenceError));
      }

      const defaultStatus = await client.query(
        `SELECT id FROM task_statuses
         WHERE project_id = $1
         ORDER BY sort_order
         LIMIT 1;`,
        [input.projectId]
      );
      const statusId: string | undefined = input.statusId ?? defaultStatus.rows[0]?.id;
      if (!statusId) {
        await client.query("ROLLBACK");
        return res.status(400).send(new ServerResponse(false, null, "Project has no statuses configured"));
      }

      const created = await client.query("SELECT create_task($1) AS task;", [JSON.stringify({
        name: input.name,
        description: input.description ? this.toDescriptionHtml(input.description) : null,
        project_id: input.projectId,
        reporter_id: userId,
        team_id: teamId,
        status_id: statusId,
        phase_id: input.phaseId,
        parent_task_id: input.parentTaskId,
        total_minutes: 0,
        assignees: input.assigneeId ? [input.assigneeId] : [],
      })]);
      const task = created.rows[0]?.task?.task;
      taskId = task?.id;
      if (!taskId) throw new Error("Task was not created");
      assignees = task.assignees || [];

      // create_task() only sets sort_order; grouped views (sprint, status, priority, member)
      // rank by their own sort columns, so new issues must go last there too.
      await client.query(
        `UPDATE tasks
         SET issue_type = $2,
             epic_id = $3,
             story_points = $4::DOUBLE PRECISION,
             status_sort_order = next_rank.value,
             priority_sort_order = next_rank.value,
             phase_sort_order = next_rank.value,
             member_sort_order = next_rank.value
         FROM (
           SELECT COALESCE(MAX(GREATEST(
                    COALESCE(sort_order, 0),
                    COALESCE(status_sort_order, 0),
                    COALESCE(priority_sort_order, 0),
                    COALESCE(phase_sort_order, 0),
                    COALESCE(member_sort_order, 0)
                  )), 0) + 1 AS value
           FROM tasks
           WHERE project_id = $5 AND id <> $1
         ) next_rank
         WHERE tasks.id = $1;`,
        [
          taskId,
          input.issueType === "subtask" ? "task" : input.issueType,
          input.epicId,
          input.storyPoints,
          input.projectId,
        ]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (input.phaseId && !input.statusId) await advanceBacklogIssuesToTodo([taskId]);

    for (const member of assignees) {
      NotificationsService.createTaskUpdate("ASSIGN", userId, taskId, member.user_id, member.team_id);
    }

    const result = await db.query(
      `SELECT t.id, CONCAT(p.key, '-', t.task_no) AS task_key
       FROM tasks t
       INNER JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1;`,
      [taskId]
    );
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  /** Flat list of the project's work items in creation order (List tab). */
  @HandleExceptions()
  public static async list(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id;
    if (!isUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    }

    const q = `
      SELECT t.id,
             CONCAT(p.key, '-', t.task_no) AS task_key,
             t.name,
             COALESCE(t.issue_type, 'task') AS issue_type,
             t.parent_task_id,
             t.story_points,
             t.is_blocked,
             t.release_id,
             ts.name AS status_name,
             stsc.color_code AS status_color,
             stsc.color_code_dark AS status_color_dark,
             COALESCE(stsc.is_done, FALSE) AS is_done,
             tp.name AS priority_name,
             tp.value AS priority_value,
             tp.color_code AS priority_color,
             tp.color_code_dark AS priority_color_dark,
             pe.id AS epic_id,
             pe.name AS epic_name,
             pe.color_code AS epic_color,
             sprint.id AS sprint_id,
             sprint.name AS sprint_name,
             assignee.name AS assignee_name,
             assignee.avatar_url AS assignee_avatar_url,
             EXISTS (
               SELECT 1 FROM tasks_assignees ta
               INNER JOIN team_members tm ON tm.id = ta.team_member_id
               WHERE ta.task_id = t.id AND tm.user_id = $2::UUID
             ) AS is_mine
      FROM tasks t
      INNER JOIN projects p ON p.id = t.project_id
      LEFT JOIN task_statuses ts ON ts.id = t.status_id
      LEFT JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
      LEFT JOIN task_priorities tp ON tp.id = t.priority_id
      LEFT JOIN project_epics pe ON pe.id = t.epic_id
      LEFT JOIN LATERAL (
        SELECT pp.id, pp.name
        FROM task_phase tph
        INNER JOIN project_phases pp ON pp.id = tph.phase_id
        WHERE tph.task_id = t.id
        LIMIT 1
      ) sprint ON TRUE
      LEFT JOIN LATERAL (
        SELECT tmiv.name, tmiv.avatar_url
        FROM tasks_assignees ta
        INNER JOIN team_member_info_view tmiv ON tmiv.team_member_id = ta.team_member_id
        WHERE ta.task_id = t.id
        ORDER BY ta.created_at
        LIMIT 1
      ) assignee ON TRUE
      WHERE t.project_id = $1::UUID
        AND t.archived IS FALSE
      ORDER BY t.created_at, t.task_no;`;
    const result = await db.query(q, [projectId, req.user?.id ?? null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  /** Returns the parsed input, or an error message when the body is invalid. */
  private static parseInput(body: Record<string, unknown> | undefined): ICreateIssueInput | string {
    const projectId = body?.project_id;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const issueType = body?.issue_type ?? "task";
    const assigneeId = body?.assignee_id ?? null;
    const epicId = body?.epic_id ?? null;
    const phaseId = body?.phase_id ?? null;
    const statusId = body?.status_id ?? null;
    const parentTaskId = body?.parent_task_id ?? null;
    const rawPoints = body?.story_points;
    const storyPoints = rawPoints === null || rawPoints === undefined ? null : Number(rawPoints);

    if (!isUuid(projectId)) return "Invalid project id";
    if (!name) return "Summary is required";
    if (name.length > this.NAME_MAX_LENGTH) return "Summary is too long";
    if (description.length > this.DESCRIPTION_MAX_LENGTH) return "Description is too long";
    if (!this.ISSUE_TYPES.includes(issueType as IssueType)) return "Invalid issue type";
    if (issueType === "subtask" && !isUuid(parentTaskId)) return "Choose a parent issue for the subtask";
    if (issueType !== "subtask" && parentTaskId !== null) return "Only subtasks can have a parent issue";
    for (const id of [assigneeId, epicId, phaseId, statusId]) {
      if (id !== null && !isUuid(id)) return "Invalid request";
    }
    if (storyPoints !== null && !(Number.isFinite(storyPoints) && storyPoints >= 0 && storyPoints <= this.MAX_POINT_VALUE)) {
      return "Invalid story points";
    }

    return {
      projectId: projectId as string,
      name,
      description: description || null,
      issueType: issueType as IssueType,
      assigneeId: assigneeId as string | null,
      epicId: epicId as string | null,
      storyPoints,
      phaseId: phaseId as string | null,
      statusId: statusId as string | null,
      parentTaskId: parentTaskId as string | null,
    };
  }

  /** Ensures every referenced record belongs to the project (or team). Returns an error message if not. */
  private static async validateReferences(client: PoolClient, input: ICreateIssueInput, teamId: string): Promise<string | null> {
    const q = `
      SELECT
        EXISTS (SELECT 1 FROM projects WHERE id = $1 AND team_id = $6) AS has_project,
        ($2::UUID IS NULL OR EXISTS (
          SELECT 1 FROM team_members WHERE id = $2::UUID AND team_id = $6)) AS has_assignee,
        ($3::UUID IS NULL OR EXISTS (
          SELECT 1 FROM project_epics WHERE id = $3::UUID AND project_id = $1 AND is_archived IS FALSE)) AS has_epic,
        ($4::UUID IS NULL OR EXISTS (
          SELECT 1 FROM project_phases WHERE id = $4::UUID AND project_id = $1)) AS has_phase,
        ($5::UUID IS NULL OR EXISTS (
          SELECT 1 FROM tasks WHERE id = $5::UUID AND project_id = $1 AND archived IS FALSE)) AS has_parent,
        ($7::UUID IS NULL OR EXISTS (
          SELECT 1 FROM task_statuses WHERE id = $7::UUID AND project_id = $1)) AS has_status;`;
    const result = await client.query(q, [
      input.projectId, input.assigneeId, input.epicId, input.phaseId, input.parentTaskId, teamId, input.statusId,
    ]);
    const [row] = result.rows;
    if (!row?.has_project) return "Project not found";
    if (!row.has_assignee) return "Assignee not found";
    if (!row.has_epic) return "Epic not found or archived";
    if (!row.has_phase) return "Sprint not found";
    if (!row.has_parent) return "Parent issue not found";
    if (!row.has_status) return "Status not found";
    return null;
  }

  /** Converts plain-text description into escaped HTML paragraphs used by the description editor. */
  private static toDescriptionHtml(text: string): string {
    const escape = (value: string) => value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    return text.split(/\r?\n/).map(line => `<p>${escape(line) || "<br>"}</p>`).join("");
  }
}
