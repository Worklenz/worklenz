import { Socket } from "socket.io";
import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { logStatusChange } from "../../services/activity-logs/activity-logs.service";
import { getColor, int, log_error } from "../../shared/utils";
import { generateProjectKey } from "../../utils/generate-project-key";
import WorklenzControllerBase from "../worklenz-controller-base";
import {
  ICustomProjectTemplate,
  ICustomTemplatePhase,
  IProjectTemplate,
  IProjectTemplateLabel,
  IProjectTemplatePhase,
  IProjectTemplateStatus,
  IProjectTemplateTask,
  ITaskIncludes,
  ICustomColumnWithConfig,
  IColumnConfiguration,
  ISelectionOption,
  ILabelOption,
} from "./interfaces";

export default abstract class ProjectTemplatesControllerBase extends WorklenzControllerBase {
  @HandleExceptions()
  protected static async insertProjectTemplate(body: IProjectTemplate) {
    const { name, key, description, phase_label } = body;

    const q = `INSERT INTO pt_project_templates(name, key, description, phase_label) VALUES ($1, $2, $3, $4) RETURNING id;`;
    const result = await db.query(q, [name, key, description, phase_label]);
    const [data] = result.rows;
    return data.id;
  }

  @HandleExceptions()
  protected static async insertTemplateProjectPhases(
    body: IProjectTemplatePhase[],
    template_id: string,
  ) {
    for await (const phase of body) {
      const { name, color_code } = phase;

      const q = `INSERT INTO pt_phases(name, color_code, template_id) VALUES ($1, $2, $3);`;
      await db.query(q, [name, color_code, template_id]);
    }
  }

  @HandleExceptions()
  protected static async insertTemplateProjectStatuses(
    body: IProjectTemplateStatus[],
    template_id: string,
  ) {
    for await (const status of body) {
      const { name, category_name, category_id } = status;

      const q = `INSERT INTO pt_statuses(name, template_id, category_id)
                    VALUES ($1, $2, (SELECT id FROM sys_task_status_categories WHERE sys_task_status_categories.name = $3));`;
      await db.query(q, [name, template_id, category_name]);
    }
  }

  @HandleExceptions()
  protected static async insertTemplateProjectTasks(
    body: IProjectTemplateTask[],
    template_id: string,
  ) {
    for await (const template_task of body) {
      const {
        name,
        description,
        total_minutes,
        sort_order,
        priority_name,
        parent_task_id,
        phase_name,
        status_name,
      } = template_task;

      const q = `INSERT INTO pt_tasks(name, description, total_minutes, sort_order, priority_id, template_id, parent_task_id, status_id)
                    VALUES ($1, $2, $3, $4, (SELECT id FROM task_priorities WHERE task_priorities.name = $5), $6, $7,
                            (SELECT id FROM pt_statuses WHERE pt_statuses.name = $8 AND pt_statuses.template_id = $6)) RETURNING id;`;
      const result = await db.query(q, [
        name,
        description,
        total_minutes,
        sort_order,
        priority_name,
        template_id,
        parent_task_id,
        status_name,
      ]);
      const [task] = result.rows;

      await this.insertTemplateTaskPhases(task.id, template_id, phase_name);
      if (template_task.labels)
        await this.insertTemplateTaskLabels(task.id, template_task.labels);
    }
  }

  @HandleExceptions()
  protected static async insertTemplateTaskPhases(
    task_id: string,
    template_id: string,
    phase_name = "",
  ) {
    const q = `INSERT INTO pt_task_phases (task_id, phase_id) VALUES ($1, (SELECT id FROM pt_phases WHERE template_id = $2 AND name = $3));`;
    await db.query(q, [task_id, template_id, phase_name]);
  }

  @HandleExceptions()
  protected static async insertTemplateTaskLabels(
    task_id: string,
    labels: IProjectTemplateLabel[],
  ) {
    for await (const label of labels) {
      const q = `INSERT INTO pt_task_labels(task_id, label_id) VALUES ($1, (SELECT id FROM pt_labels WHERE name = $2));`;
      await db.query(q, [task_id, label.name]);
    }
  }

  @HandleExceptions()
  protected static async getTemplateData(template_id: string) {
    const q = `SELECT id,
                name,
                description,
                phase_label,
                image_url,
                color_code,
                (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT name, color_code FROM pt_phases WHERE template_id = pt.id) rec) AS phases,
                (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT name,
                                category_id,
                                (SELECT color_code
                                FROM sys_task_status_categories
                                WHERE sys_task_status_categories.id = pt_statuses.category_id)
                        FROM pt_statuses
                        WHERE template_id = pt.id) rec) AS status,
                (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT name, pt_labels.color_code
                            FROM pt_labels
                            WHERE id IN (SELECT label_id
                                        FROM pt_task_labels pttl
                                        WHERE task_id IN (SELECT id
                                                            FROM pt_tasks
                                                            WHERE pt_tasks.template_id = pt.id))) rec) AS labels,
                (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT name,
                                color_code
                        FROM task_priorities) rec) AS priorities,
                (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT name,
                            (SELECT name FROM pt_statuses WHERE status_id = pt_statuses.id) AS status_name,
                            (SELECT name FROM task_priorities tp WHERE priority_id = tp.id ) AS priority_name,
                            (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT name
                                        FROM pt_phases pl
                                        WHERE pl.id =
                                            (SELECT phase_id FROM pt_task_phases WHERE task_id = pt_tasks.id)) rec) AS phases,
                            (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                FROM (SELECT name
                                        FROM pt_labels pl
                                                LEFT JOIN pt_task_labels pttl ON pl.id = pttl.label_id
                                        WHERE pttl.task_id = pt_tasks.id) rec) AS labels
                        FROM pt_tasks
                        WHERE template_id = pt.id) rec) AS tasks
                    FROM pt_project_templates pt
                    WHERE id = $1;`;
    const result = await db.query(q, [template_id]);
    const [data] = result.rows;
    if (!data) return null;

    if (!Array.isArray(data.phases)) {
      data.phases = [];
    }

    for (const phase of data.phases) {
      phase.color_code = getColor(phase.name);
    }
    return data;
  }

  @HandleExceptions()
  @HandleExceptions()
  protected static async getCustomTemplateData(template_id: string) {
    // Use recursive CTE to ensure deterministic hierarchical ordering
    // This guarantees parents are always returned before their children
    // and the order is stable across multiple query executions
    const q = `SELECT id,
                        name,
                        notes AS description,
                        phase_label,
                        color_code,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                            FROM (SELECT name, color_code FROM cpt_phases WHERE template_id = pt.id) rec) AS phases,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                            FROM (SELECT name,
                                        category_id,
                                        (SELECT color_code
                                        FROM sys_task_status_categories
                                        WHERE sys_task_status_categories.id = cpts.category_id)
                                FROM cpt_task_statuses cpts
                                WHERE template_id = pt.id ORDER BY sort_order) rec) AS status,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                            FROM (SELECT name, tl.color_code
                                FROM team_labels tl
                                WHERE id IN (SELECT label_id
                                            FROM cpt_task_labels ctl
                                            WHERE task_id IN (SELECT id
                                                                FROM cpt_tasks
                                                                WHERE cpt_tasks.template_id = pt.id))) rec) AS labels,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                            FROM (SELECT name,
                                        color_code
                                FROM task_priorities) rec) AS priorities,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                           FROM (
                                WITH RECURSIVE task_tree AS (
                                    -- Base case: root tasks (no parent)
                                    SELECT id, name, parent_task_id, description, total_minutes, 
                                           sort_order, task_no, status_sort_order, priority_sort_order, phase_sort_order,
                                           status_id, priority_id, template_id,
                                           0 AS depth,
                                           ARRAY[LPAD(sort_order::TEXT, 10, '0'), LPAD(COALESCE(task_no, 0)::TEXT, 10, '0'), id::TEXT] AS path
                                    FROM cpt_tasks
                                    WHERE template_id = pt.id AND parent_task_id IS NULL
                                    
                                    UNION ALL
                                    
                                    -- Recursive case: child tasks
                                    SELECT c.id, c.name, c.parent_task_id, c.description, c.total_minutes,
                                           c.sort_order, c.task_no, c.status_sort_order, c.priority_sort_order, c.phase_sort_order,
                                           c.status_id, c.priority_id, c.template_id,
                                           tt.depth + 1,
                                           tt.path || ARRAY[LPAD(c.sort_order::TEXT, 10, '0'), LPAD(COALESCE(c.task_no, 0)::TEXT, 10, '0'), c.id::TEXT]
                                    FROM cpt_tasks c
                                    INNER JOIN task_tree tt ON c.parent_task_id = tt.id
                                    WHERE c.template_id = pt.id
                                )
                                SELECT tt.id AS original_task_id,
                                       tt.name,
                                       tt.parent_task_id,
                                       tt.description,
                                       tt.total_minutes,
                                       tt.sort_order,
                                       tt.task_no,
                                       tt.status_sort_order,
                                       tt.priority_sort_order,
                                       tt.phase_sort_order,
                                       (SELECT name FROM cpt_task_statuses cts WHERE tt.status_id = cts.id) AS status_name,
                                       (SELECT name FROM task_priorities tp WHERE tt.priority_id = tp.id) AS priority_name,
                                       (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                        FROM (SELECT name
                                                FROM cpt_phases pl
                                                WHERE pl.id =
                                                (SELECT phase_id FROM cpt_task_phases WHERE task_id = tt.id)) rec) AS phases,
                                       (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                            FROM (SELECT name
                                                    FROM team_labels pl
                                                            LEFT JOIN cpt_task_labels cttl ON pl.id = cttl.label_id
                                                    WHERE cttl.task_id = tt.id) rec) AS labels
                                FROM task_tree tt
                                ORDER BY path
                           ) rec) AS tasks
                    FROM custom_project_templates pt
                    WHERE id = $1;`;
    const result = await db.query(q, [template_id]);
    const [data] = result.rows;
    return data;
  }

  private static async getAllKeysByTeamId(teamId?: string) {
    if (!teamId) return [];
    try {
      const result = await db.query(
        "SELECT key FROM projects WHERE team_id = $1;",
        [teamId],
      );
      return result.rows
        .map((project: any) => project.key)
        .filter((key: any) => !!key);
    } catch (error) {
      return [];
    }
  }

  private static async checkProjectNameExists(
    project_name: string,
    teamId?: string,
  ) {
    if (!teamId) return;
    try {
      const result = await db.query(
        "SELECT count(*) FROM projects WHERE name = $1 AND team_id = $2;",
        [project_name, teamId],
      );
      const [data] = result.rows;
      return int(data.count) || 0;
    } catch (error) {
      return [];
    }
  }

  protected static async importTemplate(body: any) {
    const q = `SELECT create_project($1) AS project`;

    const count = await this.checkProjectNameExists(body.name, body.team_id);
    let keys = await this.getAllKeysByTeamId(body.team_id as string);

    // Generate initial key
    let generatedKey = generateProjectKey(body.name, keys) || null;
    const originalName = body.name; // Store original name for retries
    
    // If project name exists, modify it
    if (count !== 0) {
      body.name = `${body.name} - ${generatedKey}`;
      // Add the temp key to existing keys to avoid regenerating the same key
      keys.push(generatedKey);
      // Regenerate key with the new name to ensure uniqueness
      generatedKey = generateProjectKey(body.name, keys) || null;
    }

    body.key = generatedKey;

    // Try to insert, if duplicate error, retry with a timestamp-based key
    let retries = 0;
    const maxRetries = 5;
    
    while (retries < maxRetries) {
      try {
        const result = await db.query(q, [JSON.stringify(body)]);
        const [data] = result.rows;
        return data.project.id;
      } catch (error: any) {
        retries++;
        
        if (retries >= maxRetries) {
          throw error; // Give up after max retries
        }
        
        // Check if it's a duplicate key error OR duplicate name error
        if (error.code === '23505' && error.constraint === 'projects_key_team_id_uindex') {
          // Duplicate key - generate timestamp-based key
          const timestamp = Date.now().toString(36).toUpperCase().slice(-3);
          const baseKey = body.key?.slice(0, 2) || 'PR';
          body.key = `${baseKey}${timestamp}`;
        } else if (error.code === 'P0001' && error.message?.includes('PROJECT_EXISTS_ERROR')) {
          // Duplicate name - append timestamp to name and regenerate key
          const timestamp = Date.now().toString(36).toUpperCase().slice(-3);
          body.name = `${originalName} - ${timestamp}`;
          body.key = generateProjectKey(body.name, keys) || `PR${timestamp}`;
        } else {
          throw error; // Re-throw if it's a different error
        }
      }
    }
    
    throw new Error('Failed to create project after maximum retries');
  }

  @HandleExceptions()
  protected static async insertTeamLabels(
    labels: IProjectTemplateLabel[],
    team_id = "",
  ) {
    if (!team_id) return;

    for await (const label of labels) {
      const q = `INSERT INTO team_labels(name, color_code, team_id)
                 SELECT TRIM($1), $2, $3
                 WHERE NOT EXISTS (
                   SELECT 1
                   FROM team_labels
                   WHERE team_id = $3
                     AND LOWER(TRIM(name)) = LOWER(TRIM($1))
                 );`;
      await db.query(q, [label.name, label.color_code, team_id]);
    }
  }

  @HandleExceptions()
  protected static async insertProjectPhases(
    phases: IProjectTemplatePhase[],
    project_id = "",
  ) {
    if (!project_id) return;

    let i = 0;

    for await (const phase of phases) {
      const q = `INSERT INTO project_phases(name, color_code, project_id, sort_index) VALUES ($1, $2, $3, $4);`;
      await db.query(q, [phase.name, phase.color_code, project_id, i]);
      i++;
    }
  }

  protected static async insertProjectStatuses(
    statuses: IProjectTemplateStatus[],
    project_id = "",
    team_id = "",
  ) {
    if (!project_id || !team_id) return;

    try {
      let index = 0;
      for await (const status of statuses) {
        // Use status.sort_order if available, otherwise use index to maintain order
        const sortOrder = status.sort_order !== undefined ? status.sort_order : index;
        
        const q = `INSERT INTO task_statuses(name, project_id, team_id, category_id, sort_order) VALUES($1, $2, $3, $4, $5);`;
        await db.query(q, [
          status.name,
          project_id,
          team_id,
          status.category_id,
          sortOrder,
        ]);
        
        index++;
      }
    } catch (error) {
      log_error(error);
    }
  }

  @HandleExceptions()
  protected static async insertTaskPhase(
    task_id: string,
    phase_name: string,
    project_id: string,
  ) {
    const q = `INSERT INTO task_phase(task_id, phase_id)
                VALUES ($1, (SELECT id FROM project_phases WHERE name = $2 AND project_id = $3));`;
    await db.query(q, [task_id, phase_name, project_id]);
  }

  @HandleExceptions()
  protected static async insertTaskLabel(
    task_id: string,
    label_name: string,
    team_id: string,
  ) {
    const q = `INSERT INTO task_labels(task_id, label_id)
                VALUES ($1, (SELECT id FROM team_labels WHERE name = $2 AND team_id = $3));`;
    await db.query(q, [task_id, label_name, team_id]);
  }

  protected static async insertProjectTasks(
    tasks: IProjectTemplateTask[],
    team_id: string,
    project_id = "",
    user_id = "",
    socket: Socket | null,
  ) {
    if (!project_id) return;

    try {
      for await (const [key, task] of tasks.entries()) {
        const q = `INSERT INTO tasks(name, project_id, status_id, priority_id, reporter_id,
                              sort_order, roadmap_sort_order,
                              status_sort_order, priority_sort_order, phase_sort_order, member_sort_order)
                    VALUES ($1, $2, (SELECT id FROM task_statuses ts WHERE ts.name = $3 AND ts.project_id = $2),
                            (SELECT id FROM task_priorities tp WHERE tp.name = $4), $5,
                            $6, $6,
                            $6, $6, $6, $6)
                    RETURNING id, status_id;`;
        const result = await db.query(q, [
          task.name,
          project_id,
          task.status_name,
          task.priority_name,
          user_id,
          key,
        ]);
        const [data] = result.rows;

        if (task.phases) {
          for await (const phase of task.phases) {
            await this.insertTaskPhase(
              data.id,
              phase.name as string,
              project_id,
            );
          }
        }

        if (task.labels) {
          for await (const label of task.labels) {
            await this.insertTaskLabel(data.id, label.name as string, team_id);
          }
        }

        if (socket) {
          logStatusChange({
            task_id: data.id,
            socket,
            new_value: data.status_id,
            old_value: null,
          });
        }
      }

      // Set progress_value = 100 for all tasks that are in a "Done" status category
      const progressUpdateQ = `
        UPDATE tasks
        SET progress_value = 100, manual_progress = TRUE
        WHERE project_id = $1
          AND status_id IN (
            SELECT ts.id
            FROM task_statuses ts
            JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
            WHERE ts.project_id = $1
              AND stsc.is_done IS TRUE
          )
      `;
      await db.query(progressUpdateQ, [project_id]);
    } catch (error) {
      log_error(error);
    }
  }

  // custom templates
  @HandleExceptions()
  protected static async getProjectData(project_id: string) {
    const q = `SELECT phase_label, notes, color_code FROM projects WHERE id = $1;`;
    const result = await db.query(q, [project_id]);
    const [data] = result.rows;
    return data;
  }

  @HandleExceptions()
  protected static async getProjectStatus(project_id: string) {
    const q = `SELECT name, category_id, sort_order FROM task_statuses WHERE project_id = $1;`;
    const result = await db.query(q, [project_id]);
    return result.rows;
  }

  @HandleExceptions()
  protected static async getProjectPhases(project_id: string) {
    const q = `SELECT name, color_code FROM project_phases WHERE project_id = $1 ORDER BY sort_index ASC;`;
    const result = await db.query(q, [project_id]);
    return result.rows;
  }

  @HandleExceptions()
  protected static async getProjectLabels(team_id: string, project_id: string) {
    const q = `SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(DISTINCT JSONB_BUILD_OBJECT('name', name))), '[]'::JSON) AS labels
            FROM team_labels
            WHERE team_id = $1
            AND id IN (SELECT label_id
                        FROM task_labels
                        WHERE task_id IN (SELECT id
                                        FROM tasks
                                        WHERE project_id = $2));`;
    const result = await db.query(q, [team_id, project_id]);
    const [data] = result.rows;
    return data.labels;
  }

  @HandleExceptions()
  @HandleExceptions()
  protected static async getTasksByProject(
    project_id: string,
    taskIncludes: ITaskIncludes,
  ) {
    let taskIncludesClause = "";
    let whereClause = "WHERE project_id = $1 AND archived IS FALSE";

    if (taskIncludes.description) taskIncludesClause += " description,";
    if (taskIncludes.estimation) taskIncludesClause += " total_minutes,";
    if (taskIncludes.status)
      taskIncludesClause += ` (SELECT name FROM task_statuses WHERE task_statuses.id = t.status_id) AS status_name,`;
    if (taskIncludes.labels) {
      taskIncludesClause += ` (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                    FROM (SELECT (SELECT name FROM team_labels WHERE id = task_labels.label_id)
                        FROM task_labels
                        WHERE task_id = t.id) rec) AS labels,`;
    }
    if (taskIncludes.phase) {
      taskIncludesClause += ` (SELECT name
                    FROM project_phases
                    WHERE project_phases.id = (SELECT phase_id FROM task_phase WHERE task_id = t.id)) AS phase_name,`;
    }
    if (taskIncludes.subtasks) {
      taskIncludesClause += ` parent_task_id,`;
    } else {
      // When subtasks are not included, exclude tasks that have a parent (i.e., only include top-level tasks)
      whereClause += " AND parent_task_id IS NULL";
    }

    const q = `SELECT id,
                name,
                sort_order,
                task_no,
                status_sort_order,
                priority_sort_order,
                phase_sort_order,
                ${taskIncludesClause}
                priority_id
            FROM tasks t
                ${whereClause}
            ORDER BY parent_task_id NULLS FIRST, sort_order ASC, task_no ASC;`;
    const result = await db.query(q, [project_id]);
    return result.rows;
  }

  @HandleExceptions()
  protected static async insertCustomTemplate(body: ICustomProjectTemplate) {
    const q = `SELECT create_project_template($1)`;
    const result = await db.query(q, [JSON.stringify(body)]);
    const [data] = result.rows;
    return data.id;
  }

  @HandleExceptions()
  protected static async insertCustomTemplatePhases(
    body: ICustomTemplatePhase[],
    template_id: string,
  ) {
    for await (const phase of body) {
      const { name, color_code } = phase;

      const q = `INSERT INTO cpt_phases(name, color_code, template_id) VALUES ($1, $2, $3);`;
      await db.query(q, [name, color_code, template_id]);
    }
  }

  @HandleExceptions()
  protected static async insertCustomTemplateStatus(
    body: IProjectTemplateStatus[],
    template_id: string,
    team_id: string,
  ) {
    for await (const status of body) {
      const { name, category_id, sort_order } = status;

      const q = `INSERT INTO cpt_task_statuses(name, template_id, team_id, category_id, sort_order)
                    VALUES ($1, $2, $3, $4, $5);`;
      await db.query(q, [name, template_id, team_id, category_id, sort_order]);
    }
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTasks(
    body: IProjectTemplateTask[],
    template_id: string,
    team_id: string,
    status = true,
  ) {
    // Two-pass approach to handle nested subtasks (3+ levels):
    // Pass 1: Insert all tasks without parent_task_id, storing original_task_id for mapping
    // Pass 2: Update parent_task_id relationships using the mapping

    const taskIdMap: Map<string, string> = new Map(); // original task id -> new cpt_task id

    // Pass 1: Insert all tasks without parent relationships
    for await (const task of body) {
      const {
        name,
        description,
        total_minutes,
        sort_order,
        priority_id,
        status_name,
        task_no,
        id,
        phase_name,
        status_sort_order,
        priority_sort_order,
        phase_sort_order,
      } = task;

      const q = `INSERT INTO cpt_tasks(name, description, total_minutes, sort_order, priority_id, template_id, status_id, task_no,
                      parent_task_id, original_task_id, status_sort_order, priority_sort_order, phase_sort_order)
                        VALUES ($1, $2, $3, $4, $5, $6, (SELECT id FROM cpt_task_statuses cts WHERE cts.name = $7 AND cts.template_id = $6), $8,
                                NULL, $9, $10, $11, $12)
                        RETURNING id;`;
      const result = await db.query(q, [
        name,
        description,
        total_minutes || 0,
        sort_order,
        priority_id,
        template_id,
        status_name,
        task_no,
        id,
        status_sort_order || 0,
        priority_sort_order || 0,
        phase_sort_order || 0,
      ]);
      const [data] = result.rows;

      // Store mapping from original task id to new template task id
      if (id && data.id) {
        taskIdMap.set(id, data.id);
      }

      if (data.id) {
        if (phase_name)
          await this.insertCustomTemplateTaskPhases(
            data.id,
            template_id,
            phase_name,
          );
        if (task.labels)
          await this.insertCustomTemplateTaskLabels(
            data.id,
            task.labels,
            team_id,
          );
      }
    }

    // Pass 2: Update parent_task_id relationships
    for await (const task of body) {
      if (task.parent_task_id && task.id) {
        const newTaskId = taskIdMap.get(task.id);
        const newParentId = taskIdMap.get(task.parent_task_id);

        if (newTaskId && newParentId) {
          const updateQ = `UPDATE cpt_tasks SET parent_task_id = $1 WHERE id = $2;`;
          await db.query(updateQ, [newParentId, newTaskId]);
        }
      }
    }
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTaskPhases(
    task_id: string,
    template_id: string,
    phase_name = "",
  ) {
    const q = `INSERT INTO cpt_task_phases (task_id, phase_id)
                VALUES ($1, (SELECT id FROM cpt_phases WHERE template_id = $2 AND name = $3));`;
    await db.query(q, [task_id, template_id, phase_name]);
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTaskLabels(
    task_id: string,
    labels: IProjectTemplateLabel[],
    team_id: string,
  ) {
    for await (const label of labels) {
      const q = `INSERT INTO cpt_task_labels(task_id, label_id)
                VALUES ($1, (SELECT id FROM team_labels WHERE name = $2 AND team_id = $3));`;
      await db.query(q, [task_id, label.name, team_id]);
    }
  }

  @HandleExceptions()
  protected static async updateTeamName(
    name: string,
    team_id: string,
    user_id: string,
  ) {
    const q = `UPDATE teams SET name = TRIM($1::TEXT) WHERE id = $2 AND user_id = $3;`;
    const result = await db.query(q, [name, team_id, user_id]);
    return result.rows;
  }

  @HandleExceptions()
  protected static async deleteDefaultStatusForProject(task_id: string) {
    const q = `DELETE FROM task_statuses WHERE project_id = $1;`;
    await db.query(q, [task_id]);
  }

  @HandleExceptions()
  protected static async handleAccountSetup(
    project_id: string,
    user_id: string,
    team_name: string,
  ) {
    // update user setup status
    await db.query(`UPDATE users SET setup_completed = TRUE WHERE id = $1;`, [
      user_id,
    ]);

    await db.query(
      `INSERT INTO organizations (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                            trial_expire_date, subscription_status)
                        VALUES ($1, TRIM($2::TEXT), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '14 days', 'trialing')
                        ON CONFLICT (user_id) DO UPDATE SET organization_name = TRIM($2::TEXT);`,
      [user_id, team_name],
    );
  }

  protected static async insertProjectTasksFromCustom(
    tasks: IProjectTemplateTask[],
    team_id: string,
    project_id = "",
    user_id = "",
    socket: Socket | null,
  ) {
    if (!project_id) return;

    try {
      // Two-pass approach to handle nested subtasks (3+ levels):
      // Pass 1: Insert all tasks without parent_task_id, storing mapping for later
      // Pass 2: Update parent_task_id relationships using the mapping

      const templateIdToNewIdMap: Map<string, string> = new Map();
      const tasksWithParent: Array<{
        newId: string;
        parentTemplateId: string;
      }> = [];

      // Pass 1: Insert all tasks without parent relationships
      for await (const [key, task] of tasks.entries()) {
        const q = `INSERT INTO tasks(name, project_id, status_id, priority_id, reporter_id, sort_order,
                              parent_task_id, description, total_minutes, task_no,
                              status_sort_order, priority_sort_order, phase_sort_order,
                              roadmap_sort_order, member_sort_order)
                    VALUES ($1, $2, (SELECT id FROM task_statuses ts WHERE ts.name = $3 AND ts.project_id = $2),
                            (SELECT id FROM task_priorities tp WHERE tp.name = $4), $5, $6,
                            NULL, $7, $8, $9,
                            $10, $11, $12,
                            $13, $14)
                    RETURNING id, status_id;`;

        // Use sequential index (key) for ALL sort orders to ensure deterministic ordering
        // This prevents non-deterministic ordering when importing the same template multiple times
        const sortOrderValue = key;

        const result = await db.query(q, [
          task.name,
          project_id,
          task.status_name,
          task.priority_name,
          user_id,
          sortOrderValue,   // $6  sort_order
          task.description, // $7
          task.total_minutes ? task.total_minutes : 0, // $8
          task.task_no,     // $9
          sortOrderValue,   // $10 status_sort_order
          sortOrderValue,   // $11 priority_sort_order
          sortOrderValue,   // $12 phase_sort_order
          sortOrderValue,   // $13 roadmap_sort_order
          sortOrderValue,   // $14 member_sort_order
        ]);
        const [data] = result.rows;

        // Store the mapping from template task ID (original_task_id which is cpt_tasks.id) to newly created task ID
        if (task.original_task_id) {
          templateIdToNewIdMap.set(task.original_task_id, data.id);
        }

        // Track tasks that have parents for Pass 2
        if (task.parent_task_id) {
          tasksWithParent.push({
            newId: data.id,
            parentTemplateId: task.parent_task_id,
          });
        }

        task.id = data.id;

        if (task.phases) {
          for await (const phase of task.phases) {
            await this.insertTaskPhase(
              data.id,
              phase.name as string,
              project_id,
            );
          }
        }

        if (task.labels) {
          for await (const label of task.labels) {
            await this.insertTaskLabel(data.id, label.name as string, team_id);
          }
        }

        if (socket) {
          logStatusChange({
            task_id: data.id,
            socket,
            new_value: data.status_id,
            old_value: null,
          });
        }
      }

      // Pass 2: Update parent_task_id relationships
      for (const { newId, parentTemplateId } of tasksWithParent) {
        const newParentId = templateIdToNewIdMap.get(parentTemplateId);
        if (newParentId) {
          const updateQ = `UPDATE tasks SET parent_task_id = $1 WHERE id = $2;`;
          await db.query(updateQ, [newParentId, newId]);
        }
      }

      // Set progress_value = 100 for all tasks that are in a "Done" status category
      const progressUpdateQ = `
        UPDATE tasks
        SET progress_value = 100, manual_progress = TRUE
        WHERE project_id = $1
          AND status_id IN (
            SELECT ts.id
            FROM task_statuses ts
            JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
            WHERE ts.project_id = $1
              AND stsc.is_done IS TRUE
          )
      `;
      await db.query(progressUpdateQ, [project_id]);
    } catch (error) {
      log_error(error);
    }
  }

  @HandleExceptions()
  protected static async getProjectCustomColumns(
    project_id: string,
  ): Promise<ICustomColumnWithConfig[]> {
    const q = `
      SELECT 
        cc.id,
        cc.name,
        cc.key,
        cc.field_type,
        cc.width,
        cc.is_visible,
        cc.is_custom_column,
        (
          SELECT ROW_TO_JSON(config) 
          FROM (
            SELECT 
              field_title,
              field_type,
              number_type,
              decimals,
              label,
              label_position,
              expression,
              first_numeric_column_key,
              second_numeric_column_key
            FROM cc_column_configurations 
            WHERE column_id = cc.id
          ) config
        ) AS configuration,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(sel))), '[]'::JSON)
          FROM (
            SELECT 
              selection_id,
              selection_name,
              selection_color,
              selection_order
            FROM cc_selection_options
            WHERE column_id = cc.id
            ORDER BY selection_order
          ) sel
        ) AS selection_options,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(lbl))), '[]'::JSON)
          FROM (
            SELECT 
              label_id,
              label_name,
              label_color,
              label_order
            FROM cc_label_options
            WHERE column_id = cc.id
            ORDER BY label_order
          ) lbl
        ) AS label_options
      FROM cc_custom_columns cc
      WHERE cc.project_id = $1
      ORDER BY cc.created_at;
    `;
    const result = await db.query(q, [project_id]);
    return result.rows;
  }

  @HandleExceptions()
  protected static async insertCustomTemplateColumns(
    columns: ICustomColumnWithConfig[],
    template_id: string,
  ): Promise<void> {
    // First pass: Create all columns and build a key-to-id mapping
    const keyToIdMap: Map<string, string> = new Map();
    const columnsWithIds: Array<{
      columnId: string;
      column: ICustomColumnWithConfig;
    }> = [];

    for (const column of columns) {
      // Insert the custom column
      const columnQuery = `
        INSERT INTO cpt_custom_columns (
          template_id, name, key, field_type, width, 
          is_visible, is_custom_column, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id;
      `;
      const columnResult = await db.query(columnQuery, [
        template_id,
        column.name,
        column.key,
        column.field_type,
        column.width || 150,
        column.is_visible !== false,
        column.is_custom_column !== false,
        column.sort_order || 0,
      ]);
      const columnId = columnResult.rows[0].id;

      // Store the mapping from key to new template column id
      keyToIdMap.set(column.key, columnId);
      columnsWithIds.push({ columnId, column });
    }

    // Second pass: Insert configurations with resolved column references
    for (const { columnId, column } of columnsWithIds) {
      // Insert column configuration if exists
      if (column.configuration) {
        // Resolve column key references to IDs using the mapping
        let firstNumericColumnId = null;
        let secondNumericColumnId = null;

        if (column.configuration.first_numeric_column_key) {
          firstNumericColumnId =
            keyToIdMap.get(column.configuration.first_numeric_column_key) ||
            null;
        }

        if (column.configuration.second_numeric_column_key) {
          secondNumericColumnId =
            keyToIdMap.get(column.configuration.second_numeric_column_key) ||
            null;
        }

        const configQuery = `
          INSERT INTO cpt_column_configurations (
            column_id, field_title, field_type, number_type, decimals,
            label, label_position, expression, first_numeric_column_id, second_numeric_column_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        `;
        await db.query(configQuery, [
          columnId,
          column.configuration.field_title,
          column.configuration.field_type,
          column.configuration.number_type,
          column.configuration.decimals,
          column.configuration.label,
          column.configuration.label_position,
          column.configuration.expression,
          firstNumericColumnId,
          secondNumericColumnId,
        ]);
      }

      // Insert selection options if they exist
      if (column.selection_options && column.selection_options.length > 0) {
        for (const option of column.selection_options) {
          const selectionQuery = `
            INSERT INTO cpt_selection_options (
              column_id, selection_id, selection_name, selection_color, selection_order
            ) VALUES ($1, $2, $3, $4, $5);
          `;
          await db.query(selectionQuery, [
            columnId,
            option.selection_id,
            option.selection_name,
            option.selection_color,
            option.selection_order,
          ]);
        }
      }

      // Insert label options if they exist
      if (column.label_options && column.label_options.length > 0) {
        for (const option of column.label_options) {
          const labelQuery = `
            INSERT INTO cpt_label_options (
              column_id, label_id, label_name, label_color, label_order
            ) VALUES ($1, $2, $3, $4, $5);
          `;
          await db.query(labelQuery, [
            columnId,
            option.label_id,
            option.label_name,
            option.label_color,
            option.label_order,
          ]);
        }
      }
    }
  }

  @HandleExceptions()
  protected static async getTemplateCustomColumns(
    template_id: string,
  ): Promise<ICustomColumnWithConfig[]> {
    const q = `
      SELECT 
        cc.id,
        cc.name,
        cc.key,
        cc.field_type,
        cc.width,
        cc.is_visible,
        cc.is_custom_column,
        cc.sort_order,
        (
          SELECT ROW_TO_JSON(config) 
          FROM (
            SELECT 
              field_title,
              field_type,
              number_type,
              decimals,
              label,
              label_position,
              expression,
              first_numeric_column_id,
              second_numeric_column_id
            FROM cpt_column_configurations 
            WHERE column_id = cc.id
          ) config
        ) AS configuration,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(sel))), '[]'::JSON)
          FROM (
            SELECT 
              selection_id,
              selection_name,
              selection_color,
              selection_order
            FROM cpt_selection_options
            WHERE column_id = cc.id
            ORDER BY selection_order
          ) sel
        ) AS selection_options,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(lbl))), '[]'::JSON)
          FROM (
            SELECT 
              label_id,
              label_name,
              label_color,
              label_order
            FROM cpt_label_options
            WHERE column_id = cc.id
            ORDER BY label_order
          ) lbl
        ) AS label_options
      FROM cpt_custom_columns cc
      WHERE cc.template_id = $1
      ORDER BY cc.sort_order, cc.created_at;
    `;
    const result = await db.query(q, [template_id]);
    return result.rows;
  }

  @HandleExceptions()
  protected static async insertProjectCustomColumns(
    columns: ICustomColumnWithConfig[],
    project_id: string,
  ): Promise<void> {
    for (const column of columns) {
      // Insert the custom column for the new project
      const columnQuery = `
        INSERT INTO cc_custom_columns (
          project_id, name, key, field_type, width, 
          is_visible, is_custom_column
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id;
      `;
      const columnResult = await db.query(columnQuery, [
        project_id,
        column.name,
        column.key,
        column.field_type,
        column.width || 150,
        column.is_visible !== false,
        column.is_custom_column !== false,
      ]);
      const columnId = columnResult.rows[0].id;

      // Insert column configuration if exists
      if (column.configuration) {
        const configQuery = `
          INSERT INTO cc_column_configurations (
            column_id, field_title, field_type, number_type, decimals,
            label, label_position, expression, first_numeric_column_key, second_numeric_column_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        `;
        await db.query(configQuery, [
          columnId,
          column.configuration.field_title,
          column.configuration.field_type,
          column.configuration.number_type,
          column.configuration.decimals,
          column.configuration.label,
          column.configuration.label_position,
          column.configuration.expression,
          column.configuration.first_numeric_column_key ||
            column.configuration.first_numeric_column_id,
          column.configuration.second_numeric_column_key ||
            column.configuration.second_numeric_column_id,
        ]);
      }

      // Insert selection options if they exist
      if (column.selection_options && column.selection_options.length > 0) {
        for (const option of column.selection_options) {
          const selectionQuery = `
            INSERT INTO cc_selection_options (
              column_id, selection_id, selection_name, selection_color, selection_order
            ) VALUES ($1, $2, $3, $4, $5);
          `;
          await db.query(selectionQuery, [
            columnId,
            option.selection_id,
            option.selection_name,
            option.selection_color,
            option.selection_order,
          ]);
        }
      }

      // Insert label options if they exist
      if (column.label_options && column.label_options.length > 0) {
        for (const option of column.label_options) {
          const labelQuery = `
            INSERT INTO cc_label_options (
              column_id, label_id, label_name, label_color, label_order
            ) VALUES ($1, $2, $3, $4, $5);
          `;
          await db.query(labelQuery, [
            columnId,
            option.label_id,
            option.label_name,
            option.label_color,
            option.label_order,
          ]);
        }
      }
    }
  }
}
