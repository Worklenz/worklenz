import { Socket } from "socket.io";
import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { logStatusChange } from "../../services/activity-logs/activity-logs.service";
import { getColor, int, log_error } from "../../shared/utils";
import { generateProjectKey } from "../../utils/generate-project-key";
import WorklenzControllerBase from "../worklenz-controller-base";
import { ICustomProjectTemplate, ICustomTemplatePhase, IProjectTemplate, IProjectTemplateLabel, IProjectTemplatePhase, IProjectTemplateStatus, IProjectTemplateTask, ITaskIncludes } from "./interfaces";

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
  protected static async insertTemplateProjectPhases(body: IProjectTemplatePhase[], template_id: string) {
    for await (const phase of body) {
      const { name, color_code } = phase;

      const q = `INSERT INTO pt_phases(name, color_code, template_id) VALUES ($1, $2, $3);`;
      await db.query(q, [name, color_code, template_id]);
    }
  }

  @HandleExceptions()
  protected static async insertTemplateProjectStatuses(body: IProjectTemplateStatus[], template_id: string) {
    for await (const status of body) {
      const { name, category_name, category_id } = status;

      const q = `INSERT INTO pt_statuses(name, template_id, category_id)
                    VALUES ($1, $2, (SELECT id FROM sys_task_status_categories WHERE sys_task_status_categories.name = $3));`;
      await db.query(q, [name, template_id, category_name]);
    }
  }

  @HandleExceptions()
  protected static async insertTemplateProjectTasks(body: IProjectTemplateTask[], template_id: string) {
    for await (const template_task of body) {
      const { name, description, total_minutes, sort_order, priority_name, parent_task_id, phase_name, status_name } = template_task;

      const q = `INSERT INTO pt_tasks(name, description, total_minutes, sort_order, priority_id, template_id, parent_task_id, status_id)
                    VALUES ($1, $2, $3, $4, (SELECT id FROM task_priorities WHERE task_priorities.name = $5), $6, $7,
                            (SELECT id FROM pt_statuses WHERE pt_statuses.name = $8 AND pt_statuses.template_id = $6)) RETURNING id;`;
      const result = await db.query(q, [name, description, total_minutes, sort_order, priority_name, template_id, parent_task_id, status_name]);
      const [task] = result.rows;

      await this.insertTemplateTaskPhases(task.id, template_id, phase_name);
      if (template_task.labels) await this.insertTemplateTaskLabels(task.id, template_task.labels);
    }
  }

  @HandleExceptions()
  protected static async insertTemplateTaskPhases(task_id: string, template_id: string, phase_name = "") {
    const q = `INSERT INTO pt_task_phases (task_id, phase_id) VALUES ($1, (SELECT id FROM pt_phases WHERE template_id = $2 AND name = $3));`;
    await db.query(q, [task_id, template_id, phase_name]);
  }

  @HandleExceptions()
  protected static async insertTemplateTaskLabels(task_id: string, labels: IProjectTemplateLabel[]) {
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
    for (const phase of data.phases) {
      phase.color_code = getColor(phase.name);
    }
    return data;
  }

  @HandleExceptions()
  protected static async getCustomTemplateData(template_id: string) {
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
                           FROM (SELECT id AS original_task_id,
                                        name,
                                        parent_task_id,
                                        description,
                                        total_minutes,
                                        (SELECT name FROM cpt_task_statuses cts WHERE status_id = cts.id) AS status_name,
                                        (SELECT name FROM task_priorities tp WHERE priority_id = tp.id) AS priority_name,

                                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                        FROM (SELECT name
                                                FROM cpt_phases pl
                                                WHERE pl.id =
                                                    (SELECT phase_id FROM cpt_task_phases WHERE task_id = cpt_tasks.id)) rec) AS phases,
                                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                            FROM (SELECT name
                                                    FROM team_labels pl
                                                            LEFT JOIN cpt_task_labels cttl ON pl.id = cttl.label_id
                                                    WHERE cttl.task_id = cpt_tasks.id) rec) AS labels
                                FROM cpt_tasks
                                WHERE template_id = pt.id
                                ORDER BY parent_task_id NULLS FIRST) rec) AS tasks
                    FROM custom_project_templates pt
                    WHERE id =  $1;`;
    const result = await db.query(q, [template_id]);
    const [data] = result.rows;
    return data;
  }

  private static async getAllKeysByTeamId(teamId?: string) {
    if (!teamId) return [];
    try {
      const result = await db.query("SELECT key FROM projects WHERE team_id = $1;", [teamId]);
      return result.rows.map((project: any) => project.key).filter((key: any) => !!key);
    } catch (error) {
      return [];
    }
  }

  private static async checkProjectNameExists(project_name: string, teamId?: string) {
    if (!teamId) return;
    try {
      const result = await db.query("SELECT count(*) FROM projects WHERE name = $1 AND team_id = $2;", [project_name, teamId]);
      const [data] = result.rows;
      return int(data.count) || 0;
    } catch (error) {
      return [];
    }
  }

  @HandleExceptions()
  protected static async importTemplate(body: any) {
    const q = `SELECT create_project($1) AS project`;

    const count = await this.checkProjectNameExists(body.name, body.team_id);

    const keys = await this.getAllKeysByTeamId(body.team_id as string);
    body.key = generateProjectKey(body.name, keys) || null;

    if (count !== 0) body.name = `${body.name} - ${body.key}`;

    const result = await db.query(q, [JSON.stringify(body)]);
    const [data] = result.rows;

    return data.project.id;
  }

  @HandleExceptions()
  protected static async insertTeamLabels(labels: IProjectTemplateLabel[], team_id = "") {
    if (!team_id) return;

    for await (const label of labels) {
      const q = `INSERT INTO team_labels(name, color_code, team_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (name, team_id) DO NOTHING;`;
      await db.query(q, [label.name, label.color_code, team_id]);
    }
  }

  @HandleExceptions()
  protected static async insertProjectPhases(phases: IProjectTemplatePhase[], project_id = "",) {
    if (!project_id) return;

    let i = 0;

    for await (const phase of phases) {
      const q = `INSERT INTO project_phases(name, color_code, project_id, sort_index) VALUES ($1, $2, $3, $4);`;
      await db.query(q, [phase.name, phase.color_code, project_id, i]);
      i++;
    }
  }

  protected static async insertProjectStatuses(statuses: IProjectTemplateStatus[], project_id = "", team_id = "") {
    if (!project_id || !team_id) return;

    try {
      for await (const status of statuses) {
        const q = `INSERT INTO task_statuses(name, project_id, team_id, category_id) VALUES($1, $2, $3, $4);`;
        await db.query(q, [status.name, project_id, team_id, status.category_id]);
      }
    } catch (error) {
      log_error(error);
    }
  }

  @HandleExceptions()
  protected static async insertTaskPhase(task_id: string, phase_name: string, project_id: string) {
    const q = `INSERT INTO task_phase(task_id, phase_id)
                VALUES ($1, (SELECT id FROM project_phases WHERE name = $2 AND project_id = $3));`;
    await db.query(q, [task_id, phase_name, project_id]);
  }

  @HandleExceptions()
  protected static async insertTaskLabel(task_id: string, label_name: string, team_id: string) {
    const q = `INSERT INTO task_labels(task_id, label_id)
                VALUES ($1, (SELECT id FROM team_labels WHERE name = $2 AND team_id = $3));`;
    await db.query(q, [task_id, label_name, team_id]);
  }

  protected static async insertProjectTasks(tasks: IProjectTemplateTask[], team_id: string, project_id = "", user_id = "", socket: Socket | null) {
    if (!project_id) return;

    try {
      for await (const [key, task] of tasks.entries()) {
        const q = `INSERT INTO tasks(name, project_id, status_id, priority_id, reporter_id, sort_order)
                    VALUES ($1, $2, (SELECT id FROM task_statuses ts WHERE ts.name = $3 AND ts.project_id = $2),
                            (SELECT id FROM task_priorities tp WHERE tp.name = $4), $5, $6)
                    RETURNING id, status_id;`;
        const result = await db.query(q, [task.name, project_id, task.status_name, task.priority_name, user_id, key]);
        const [data] = result.rows;

        if (task.phases) {
          for await (const phase of task.phases) {
            await this.insertTaskPhase(data.id, phase.name as string, project_id);
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
            old_value: null
          });
        }

      }
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
  protected static async getTasksByProject(project_id: string, taskIncludes: ITaskIncludes) {
    let taskIncludesClause = "";

    if (taskIncludes.description) taskIncludesClause += " description,";
    if (taskIncludes.estimation) taskIncludesClause += " total_minutes,";
    if (taskIncludes.status) taskIncludesClause += ` (SELECT name FROM task_statuses WHERE status_id = id) AS status_name,`;
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
    }

    const q = `SELECT id,
                name,
                sort_order,
                task_no,
                ${taskIncludesClause}
                priority_id
            FROM tasks t
                WHERE project_id = $1
                AND archived IS FALSE ORDER BY parent_task_id NULLS FIRST;`;
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
  protected static async insertCustomTemplatePhases(body: ICustomTemplatePhase[], template_id: string) {
    for await (const phase of body) {
      const { name, color_code } = phase;

      const q = `INSERT INTO cpt_phases(name, color_code, template_id) VALUES ($1, $2, $3);`;
      await db.query(q, [name, color_code, template_id]);
    }
  }

  @HandleExceptions()
  protected static async insertCustomTemplateStatus(body: IProjectTemplateStatus[], template_id: string, team_id: string) {
    for await (const status of body) {
      const { name, category_id, sort_order } = status;

      const q = `INSERT INTO cpt_task_statuses(name, template_id, team_id, category_id, sort_order)
                    VALUES ($1, $2, $3, $4, $5);`;
      await db.query(q, [name, template_id, team_id, category_id, sort_order]);
    }
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTasks(body: IProjectTemplateTask[], template_id: string, team_id: string, status = true) {
    for await (const task of body) {
      const { name, description, total_minutes, sort_order, priority_id, status_name, task_no, parent_task_id, id, phase_name } = task;

      const q = `INSERT INTO cpt_tasks(name, description, total_minutes, sort_order, priority_id, template_id, status_id, task_no,
                      parent_task_id, original_task_id)
                        VALUES ($1, $2, $3, $4, $5, $6, (SELECT id FROM cpt_task_statuses cts WHERE cts.name = $7 AND cts.template_id = $6), $8,
                                (SELECT id FROM cpt_tasks WHERE original_task_id = $9 AND template_id = $6), $10)
                        RETURNING id;`;
      const result = await db.query(q, [name, description, total_minutes || 0, sort_order, priority_id, template_id, status_name, task_no, parent_task_id, id]);
      const [data] = result.rows;

      if (data.id) {
        if (phase_name) await this.insertCustomTemplateTaskPhases(data.id, template_id, phase_name);
        if (task.labels) await this.insertCustomTemplateTaskLabels(data.id, task.labels, team_id);
      }
    }
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTaskPhases(task_id: string, template_id: string, phase_name = "") {
    const q = `INSERT INTO cpt_task_phases (task_id, phase_id)
                VALUES ($1, (SELECT id FROM cpt_phases WHERE template_id = $2 AND name = $3));`;
    await db.query(q, [task_id, template_id, phase_name]);
  }

  @HandleExceptions()
  protected static async insertCustomTemplateTaskLabels(task_id: string, labels: IProjectTemplateLabel[], team_id: string) {
    for await (const label of labels) {
      const q = `INSERT INTO cpt_task_labels(task_id, label_id)
                VALUES ($1, (SELECT id FROM team_labels WHERE name = $2 AND team_id = $3));`;
      await db.query(q, [task_id, label.name, team_id]);
    }
  }

  @HandleExceptions()
  protected static async updateTeamName(name: string, team_id: string, user_id: string) {
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
  protected static async handleAccountSetup(project_id: string, user_id: string, team_name: string) {
    // update user setup status
    await db.query(`UPDATE users SET setup_completed = TRUE WHERE id = $1;`, [user_id]);

    await db.query(`INSERT INTO organizations (user_id, organization_name, contact_number, contact_number_secondary, trial_in_progress,
                            trial_expire_date, subscription_status)
                        VALUES ($1, TRIM($2::TEXT), NULL, NULL, TRUE, CURRENT_DATE + INTERVAL '14 days', 'trialing')
                        ON CONFLICT (user_id) DO UPDATE SET organization_name = TRIM($2::TEXT);`, [user_id, team_name]);
  }

  protected static async insertProjectTasksFromCustom(tasks: IProjectTemplateTask[], team_id: string, project_id = "", user_id = "", socket: Socket | null) {
    if (!project_id) return;

    try {
      for await (const [key, task] of tasks.entries()) {
        const q = `INSERT INTO tasks(name, project_id, status_id, priority_id, reporter_id, sort_order, parent_task_id, description, total_minutes)
                    VALUES ($1, $2, (SELECT id FROM task_statuses ts WHERE ts.name = $3 AND ts.project_id = $2),
                            (SELECT id FROM task_priorities tp WHERE tp.name = $4), $5, $6, $7, $8, $9)
                    RETURNING id, status_id;`;

        const parent_task: IProjectTemplateTask = tasks.find(t => t.original_task_id === task.parent_task_id) || {};

        const result = await db.query(q, [task.name, project_id, task.status_name, task.priority_name, user_id, key, parent_task.id, task.description, task.total_minutes ? task.total_minutes : 0]);
        const [data] = result.rows;
        task.id = data.id;

        if (task.phases) {
          for await (const phase of task.phases) {
            await this.insertTaskPhase(data.id, phase.name as string, project_id);
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
            old_value: null
          });
        }

      }
    } catch (error) {
      log_error(error);
    }
  }
}
