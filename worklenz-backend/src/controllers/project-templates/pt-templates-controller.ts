import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import HandleExceptions from "../../decorators/handle-exceptions";
import { templateData } from "./project-templates";
import ProjectTemplatesControllerBase from "./project-templates-base";
import {
  LOG_DESCRIPTIONS,
  TASK_PRIORITY_COLOR_ALPHA,
  TASK_STATUS_COLOR_ALPHA,
} from "../../shared/constants";
import { IO } from "../../shared/io";
import {
  getCurrentProjectsCount,
  getFreePlanSettings,
} from "../../shared/paddle-utils";
import { hasBusinessPlanAccess } from "../../middlewares/subscription-middleware";
import OnboardingController from "../onboarding-controller";
import { IProjectTemplateSettingsOverrides, IProjectTemplateApplySkip } from "./interfaces";
import { allocateCopyName } from "../../shared/template-copy-name";
import { getColor } from "../../shared/utils";
import { getProjectAccessForRequest } from "../../shared/project-access";
import { stripFinanceFromTemplateSettings } from "../../shared/strip-finance-fields";
import { hasTeamAdminPrivileges } from "../../shared/team-permissions";

export default class ProjectTemplatesController extends ProjectTemplatesControllerBase {
  @HandleExceptions()
  public static async getTemplates(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `
      SELECT
        pt.id,
        pt.name,
        pt.image_url,
        (SELECT COUNT(*) FROM pt_tasks WHERE template_id = pt.id)::int AS task_count,
        (SELECT COUNT(*) FROM pt_phases WHERE template_id = pt.id)::int AS phase_count
      FROM pt_project_templates pt
      ORDER BY pt.name;
    `;
    const result = await db.query(q, []);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getCustomTemplates(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { searchQuery } = this.toPaginationOptions(req.query, "cpt.name");

    const q = `
      SELECT
        cpt.id,
        cpt.name,
        cpt.color_code,
        cpt.created_at,
        cpt.scope,
        (cpt.team_id = $1) AS can_manage,
        FALSE AS selected,
        (SELECT COUNT(*) FROM cpt_tasks WHERE template_id = cpt.id)::int AS task_count,
        (SELECT COUNT(*) FROM cpt_phases WHERE template_id = cpt.id)::int AS phase_count
      FROM custom_project_templates cpt
      WHERE (
        cpt.team_id = $1
        OR (
          cpt.scope = 'organization'
          AND in_organization(cpt.team_id, $1)
        )
      ) ${searchQuery}
      ORDER BY cpt.name;
    `;
    const result = await db.query(q, [req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getCustomTemplateById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const access = await ProjectTemplatesController.getCustomTemplateAccess(
      id,
      req.user?.team_id
    );
    if (!access?.canAccess) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Template not found."));
    }

    const data = await ProjectTemplatesController.getCustomTemplateData(id);
    if (!data) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Template not found."));
    }

    // Phase 5 / D6: hide financial template fields from non-Admin creators in preview.
    // Values are still applied on import when plan allows.
    if (!hasTeamAdminPrivileges(req.user) && data.settings) {
      data.settings = stripFinanceFromTemplateSettings(
        data.settings as Record<string, unknown>,
        false
      );
      if (data.includes?.projectSettings) {
        data.includes = {
          ...data.includes,
          projectSettings: {
            ...data.includes.projectSettings,
            budget: false,
          },
        };
      }
    }

    return res.status(200).send(new ServerResponse(true, data));
  }


  @HandleExceptions()
  public static async deleteCustomTemplate(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;

    const q = `DELETE FROM custom_project_templates WHERE id = $1 AND team_id = $2 RETURNING id;`;
    const result = await db.query(q, [id, req.user?.team_id]);
    if (!result.rowCount) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Template not found."));
    }
    return res
      .status(200)
      .send(new ServerResponse(true, [], "Template deleted successfully."));
  }

  @HandleExceptions()
  public static async renameCustomTemplate(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { name } = req.body;
    if (!id || !name)
      return res
        .status(400)
        .send(new ServerResponse(false, {}, "Invalid request."));
    const q = `UPDATE custom_project_templates SET name = $1 WHERE id = $2 AND team_id = $3 RETURNING id, name;`;
    const result = await db.query(q, [name.trim(), id, req.user?.team_id]);
    if (result.rowCount === 1) {
      return res
        .status(200)
        .send(
          new ServerResponse(
            true,
            result.rows[0],
            "Template renamed successfully."
          )
        );
    }
    return res
      .status(404)
      .send(new ServerResponse(false, {}, "Template not found."));
  }

  @HandleExceptions()
  public static async updateCustomTemplateScope(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { scope } = req.body;
    const teamId = req.user?.team_id;

    if (!id || !teamId) {
      return res
        .status(400)
        .send(new ServerResponse(false, {}, "Invalid request."));
    }

    if (!["team", "organization"].includes(scope)) {
      return res
        .status(400)
        .send(new ServerResponse(false, {}, "Invalid scope value."));
    }

    const q = `
      UPDATE custom_project_templates
      SET scope = $1, updated_at = NOW()
      WHERE id = $2 AND team_id = $3
      RETURNING id, scope;
    `;
    const result = await db.query(q, [scope, id, teamId]);
    if (!result.rowCount) {
      return res
        .status(404)
        .send(new ServerResponse(false, {}, "Template not found."));
    }

    return res.status(200).send(
      new ServerResponse(
        true,
        result.rows[0],
        "Template scope updated successfully."
      )
    );
  }

  @HandleExceptions()
  public static async getDefaultProjectStatus() {
    const q = `SELECT id FROM sys_project_statuses WHERE is_default IS TRUE;`;
    const result = await db.query(q, []);
    const [data] = result.rows;
    return data.id;
  }

  @HandleExceptions()
  public static async getDefaultProjectHealth() {
    const q = `SELECT id FROM sys_project_healths WHERE is_default IS TRUE`;
    const result = await db.query(q, []);
    const [data] = result.rows;
    return data.id;
  }

  @HandleExceptions()
  public static async getTemplateById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const data = await this.getTemplateData(id);
    if (!data) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Template not found."));
    }

    for (const phase of data.phases) {
      phase.color_code = phase.color_code + TASK_STATUS_COLOR_ALPHA;
    }

    for (const status of data.status) {
      status.color_code = status.color_code + TASK_STATUS_COLOR_ALPHA;
    }

    for (const priority of data.priorities) {
      priority.color_code = priority.color_code + TASK_PRIORITY_COLOR_ALPHA;
    }

    for (const label of data.labels) {
      label.color_code = label.color_code + TASK_STATUS_COLOR_ALPHA;
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async createTemplates(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    for (const template of templateData) {
      let template_id: string | null = null;
      template_id = await this.insertProjectTemplate(template);
      if (template_id) {
        await this.insertTemplateProjectPhases(template.phases, template_id);
        await this.insertTemplateProjectStatuses(template.status, template_id);
        await this.insertTemplateProjectTasks(template.tasks, template_id);
      }
    }
    return res.status(200).send(new ServerResponse(true, []));
  }

  @HandleExceptions()
  public static async importTemplates(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (req.user?.subscription_status === "free" && req.user?.owner_id) {
      const limits = await getFreePlanSettings();
      const projectsCount = await getCurrentProjectsCount(req.user.owner_id);
      const projectsLimit = parseInt(limits.projects_limit);

      if (parseInt(projectsCount) >= projectsLimit) {
        return res
          .status(200)
          .send(
            new ServerResponse(
              false,
              [],
              `Sorry, the free plan cannot have more than ${projectsLimit} projects.`
            )
          );
      }
    }

    const { template_id, project_name, color_code } = req.body;
    let project_id: string | null = null;

    const data = await this.getTemplateData(template_id);
    if (data) {
      const safeProjectName =
        typeof project_name === "string" ? project_name.trim() : "";
      const safeColorCode =
        typeof color_code === "string" ? color_code.trim() : "";

      // Check for duplicate project name before creating
      const nameToUse = safeProjectName || data.name;
      if (await this.findDuplicateProjectName(nameToUse, req.user?.team_id)) {
        return res.status(200).send(
          new ServerResponse(false, null, `A project with the name "${nameToUse}" already exists. Please choose a different name.`)
        );
      }

      // Store the nested arrays separately
      const tasks = data.tasks;
      const phases = data.phases;
      const labels = data.labels;

      // Create a clean project object with only the fields needed for create_project
      const projectData: any = {
        name: safeProjectName || data.name,
        notes: data.description ? data.description.substring(0, 500) : null, // truncate to DB limit of 500 chars
        phase_label: data.phase_label,
        color_code: safeColorCode || data.color_code,
        image_url: data.image_url,
        team_id: req.user?.team_id || null,
        user_id: req.user?.id || null,
        folder_id: null,
        category_id: null,
        status_id: await this.getDefaultProjectStatus(),
        project_created_log: LOG_DESCRIPTIONS.PROJECT_CREATED,
        project_member_added_log: LOG_DESCRIPTIONS.PROJECT_MEMBER_ADDED,
        health_id: await this.getDefaultProjectHealth(),
        working_days: 0,
        man_days: 0,
        hours_per_day: 8
      };

      project_id = await this.importTemplate(projectData);

      await this.insertTeamLabels(labels, req.user?.team_id);
      await this.insertProjectPhases(phases, project_id as string);
      await this.insertProjectTasks(
        tasks,
        projectData.team_id,
        project_id as string,
        projectData.user_id,
        IO.getSocketById(req.user?.socket_id as string)
      );

      // Phase 5: creator becomes PM with finance off (Worklenz templates have no template PM).
      const worklenzSkips: IProjectTemplateApplySkip[] = [];
      await this.applyTemplateProjectManagers(
        project_id as string,
        null,
        req.user?.team_id as string,
        req.user?.id || null,
        req.user?.team_member_id,
        hasTeamAdminPrivileges(req.user),
        worklenzSkips
      );

      this.logProjectCreatedFromTemplate(req.user, projectData.name);

      return res.status(200).send(
        new ServerResponse(true, {
          project_id,
          skips: worklenzSkips,
        })
      );
    }
    return res.status(200).send(new ServerResponse(true, { project_id, skips: [] }));
  }

  @HandleExceptions({
    raisedExceptions: {
      TEMPLATE_EXISTS_ERROR: `A template with the name "{0}" already exists. Please choose a different name.`,
    },
  })
  public static async createCustomTemplate(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const {
      project_id,
      templateName,
      projectIncludes = {},
      projectSettingsIncludes = {},
      taskIncludes = {},
      includeCustomColumns,
    } = req.body;
    const team_id = req.user?.team_id || null;

    if (!team_id || !project_id)
      return res.status(400).send(new ServerResponse(false, {}));

    let status,
      labels,
      phases = [];

    const data = await this.getProjectData(project_id);

    if (projectIncludes.statuses) {
      status = await this.getProjectStatus(project_id);
    }
    if (projectIncludes.phases) {
      phases = await this.getProjectPhases(project_id);
    }
    if (projectIncludes.labels) {
      labels = await this.getProjectLabels(team_id, project_id);
    }

    const normalizedTaskIncludes = {
      status: taskIncludes.status !== false,
      phase: Boolean(taskIncludes.phase),
      labels: Boolean(taskIncludes.labels),
      estimation: Boolean(taskIncludes.estimation),
      description: Boolean(taskIncludes.description),
      subtasks: Boolean(taskIncludes.subtasks),
      assignees: Boolean(taskIncludes.assignees),
      recurrence: Boolean(taskIncludes.recurrence),
      dependencies: Boolean(taskIncludes.dependencies),
      billable: Boolean(taskIncludes.billable),
      dateOffsets: taskIncludes.dateOffsets !== false,
    };

    const normalizedSettingsIncludes = {
      category: Boolean(projectSettingsIncludes.category),
      projectManager: Boolean(projectSettingsIncludes.projectManager),
      estimatedWorkingDays: Boolean(projectSettingsIncludes.estimatedWorkingDays),
      estimatedManDays: Boolean(projectSettingsIncludes.estimatedManDays),
      hoursPerDay: Boolean(projectSettingsIncludes.hoursPerDay),
      advanced: Boolean(projectSettingsIncludes.advanced),
      budget: Boolean(projectSettingsIncludes.budget),
    };

    // Phase 4: non-finance users cannot persist budget/rate card into a template.
    const access = await getProjectAccessForRequest(req, project_id);
    if (!access.permissions.finance) {
      normalizedSettingsIncludes.budget = false;
    }

    const tasks = await this.getTasksByProject(
      project_id,
      normalizedTaskIncludes,
      data?.start_date
    );

    let settingsSnapshot = await this.getProjectSettingsSnapshot(
      project_id,
      normalizedSettingsIncludes,
      data?.project_duration_days
    );

    if (!access.permissions.finance && settingsSnapshot) {
      settingsSnapshot = stripFinanceFromTemplateSettings(
        settingsSnapshot as Record<string, unknown>,
        false
      ) as typeof settingsSnapshot;
    }

    const includesPayload = {
      project: {
        statuses: Boolean(projectIncludes.statuses),
        phases: Boolean(projectIncludes.phases),
        labels: Boolean(projectIncludes.labels),
        customColumns: Boolean(
          includeCustomColumns ?? projectIncludes.customColumns
        ),
      },
      projectSettings: normalizedSettingsIncludes,
      task: normalizedTaskIncludes,
    };

    data.name = templateName;
    data.team_id = team_id;

    const q = `SELECT create_project_template($1);`;
    const result = await db.query(q, [JSON.stringify(data)]);
    const [obj] = result.rows;

    const template_id = obj.create_project_template.id;

    if (template_id) {
      await db.query(
        `UPDATE custom_project_templates
         SET schema_version = $2,
             includes = $3::jsonb,
             settings = $4::jsonb
         WHERE id = $1;`,
        [
          template_id,
          2,
          JSON.stringify(includesPayload),
          JSON.stringify(settingsSnapshot),
        ]
      );

      if (phases) await this.insertCustomTemplatePhases(phases, template_id);
      if (status)
        await this.insertCustomTemplateStatus(status, template_id, team_id);
      if (tasks)
        await this.insertCustomTemplateTasks(tasks, template_id, team_id);

      if (normalizedSettingsIncludes.budget && settingsSnapshot.budget?.rate_card?.length) {
        await this.insertTemplateRateCardRoles(
          template_id,
          settingsSnapshot.budget.rate_card
        );
      }

      // Handle custom columns if requested
      if (includeCustomColumns || projectIncludes.customColumns) {
        const customColumns = await this.getProjectCustomColumns(project_id);
        if (customColumns && customColumns.length > 0) {
          await this.insertCustomTemplateColumns(customColumns, template_id);
          const updateQuery = `UPDATE custom_project_templates SET include_custom_columns = TRUE WHERE id = $1;`;
          await db.query(updateQuery, [template_id]);
        }
      }
    }

    return res
      .status(200)
      .send(
        new ServerResponse(true, { id: template_id }, "Project template created successfully.")
      );
  }

  @HandleExceptions()
  public static async setupAccount(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    return OnboardingController.setupAccountFromTemplate(req, res);
  }

  @HandleExceptions()
  public static async importCustomTemplate(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (req.user?.subscription_status === "free" && req.user?.owner_id) {
      const limits = await getFreePlanSettings();
      const projectsCount = await getCurrentProjectsCount(req.user.owner_id);
      const projectsLimit = parseInt(limits.projects_limit);

      if (parseInt(projectsCount) >= projectsLimit) {
        return res
          .status(200)
          .send(
            new ServerResponse(
              false,
              [],
              `Sorry, the free plan cannot have more than ${projectsLimit} projects.`
            )
          );
      }
    }

    const { template_id, project_name, color_code, start_date, settings_overrides } =
      req.body;
    let project_id: string | null = null;

    const access = await this.getCustomTemplateAccess(
      template_id,
      req.user?.team_id
    );
    if (!access?.canAccess) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Template not found."));
    }

    const data = await this.getCustomTemplateData(template_id);

    if (data) {
      const safeProjectName =
        typeof project_name === "string" ? project_name.trim() : "";
      const safeColorCode =
        typeof color_code === "string" ? color_code.trim() : "";

      // Check for duplicate project name before creating
      const nameToUse = safeProjectName || data.name;
      if (await this.findDuplicateProjectName(nameToUse, req.user?.team_id)) {
        return res.status(200).send(
          new ServerResponse(false, null, `A project with the name "${nameToUse}" already exists. Please choose a different name.`)
        );
      }

      // Store the nested arrays separately
      const tasks = data.tasks;
      const phases = data.phases;
      const status = data.status;
      const labels = data.labels;

      // If no project name provided, use the template name
      const projectName = nameToUse;

      const projectStartDate =
        typeof start_date === "string" && start_date.trim()
          ? start_date.trim()
          : null;

      const settings =
        data.settings && typeof data.settings === "object" ? data.settings : {};
      const overrides: IProjectTemplateSettingsOverrides | null =
        settings_overrides && typeof settings_overrides === "object"
          ? settings_overrides
          : null;

      const isTeamAdmin = hasTeamAdminPrivileges(req.user);

      // Non-admin creators cannot assign another PM or change finance via overrides.
      if (!isTeamAdmin && overrides) {
        delete overrides.project_manager_id;
        delete overrides.budget;
      }

      const projectDurationDays =
        settings.project_duration_days !== undefined &&
        settings.project_duration_days !== null
          ? Number(settings.project_duration_days)
          : null;

      let projectEndDate: string | null = null;
      if (
        projectStartDate &&
        projectDurationDays !== null &&
        Number.isFinite(projectDurationDays)
      ) {
        const start = new Date(`${projectStartDate}T00:00:00.000Z`);
        if (!Number.isNaN(start.getTime())) {
          start.setUTCDate(start.getUTCDate() + projectDurationDays);
          projectEndDate = start.toISOString().slice(0, 10);
        }
      }

      const merged = this.mergeProjectSettingsForImport(settings, overrides);
      const resolvedCategoryId = await this.resolveImportCategoryId(
        merged.category_id,
        req.user?.team_id
      );

      const skips: IProjectTemplateApplySkip[] = [];
      const includes =
        data.includes && typeof data.includes === "object" ? data.includes : {};
      const taskIncludes = includes.task || {};

      if (merged.category_id && !resolvedCategoryId) {
        skips.push({
          type: "category",
          reason: "missing_on_team",
          detail: "Category from template was not found on this team.",
        });
      }

      // Create a clean project object with only the fields needed for create_project
      const projectData: any = {
        name: projectName,
        notes: data.description ? data.description.substring(0, 500) : null, // truncate to DB limit of 500 chars
        phase_label: data.phase_label,
        color_code: safeColorCode || data.color_code,
        team_id: req.user?.team_id || null,
        user_id: req.user?.id || null,
        folder_id: null,
        category_id: resolvedCategoryId,
        status_id: await this.getDefaultProjectStatus(),
        project_created_log: LOG_DESCRIPTIONS.PROJECT_CREATED,
        project_member_added_log: LOG_DESCRIPTIONS.PROJECT_MEMBER_ADDED,
        working_days: merged.working_days,
        man_days: merged.man_days,
        hours_per_day: merged.hours_per_day,
        use_manual_progress: merged.advanced.use_manual_progress ?? false,
        use_weighted_progress: merged.advanced.use_weighted_progress ?? false,
        use_time_progress: merged.advanced.use_time_progress ?? false,
        auto_assign_task_creator: merged.advanced.auto_assign_task_creator ?? false,
        restrict_task_creation: merged.advanced.restrict_task_creation ?? false,
        phase_assignees_enabled: merged.advanced.phase_assignees_enabled ?? false,
        start_date: projectStartDate,
        end_date: projectEndDate,
      };

      project_id = await this.importTemplate(projectData);

      try {
        const hasBusinessAccess = hasBusinessPlanAccess(req.user);

        // Budget is plan-gated
        if (merged.budget) {
          if (hasBusinessAccess) {
            await this.applyImportedBudget(project_id as string, merged.budget);
          } else {
            skips.push({
              type: "plan_gated",
              reason: "budget",
              detail: "Budget settings require a Business or Enterprise plan.",
            });
          }
        }

        // Project manager — Phase 5: creator always PM (finance off); template PM
        // only when caller is Owner/Admin and id differs from creator.
        await this.applyTemplateProjectManagers(
          project_id as string,
          merged.project_manager_id || null,
          req.user?.team_id as string,
          req.user?.id || null,
          req.user?.team_member_id,
          isTeamAdmin,
          skips
        );

        // Rate card roles (plan-gated with budget)
        const rateCard = settings?.budget?.rate_card as
          | { job_title_id?: string | null; job_title_name: string; rate: number; man_day_rate?: number | null }[]
          | undefined;
        if (rateCard?.length && merged.budget) {
          if (hasBusinessAccess && req.user?.team_id) {
            await this.applyImportedRateCard(
              project_id as string,
              req.user.team_id,
              rateCard,
              skips
            );
          } else if (!hasBusinessAccess) {
            skips.push({
              type: "plan_gated",
              reason: "rate_card",
              detail: "Rate card requires a Business or Enterprise plan.",
            });
          }
        }

        await this.deleteDefaultStatusForProject(project_id as string);
        await this.insertTeamLabels(labels, req.user?.team_id);
        await this.insertProjectPhases(phases, project_id as string);
        await this.insertProjectStatuses(
          status,
          project_id as string,
          projectData.team_id
        );
        const taskSkips = await this.insertProjectTasksFromCustom(
          tasks,
          projectData.team_id,
          project_id as string,
          projectData.user_id,
          IO.getSocketById(req.user?.socket_id as string),
          projectStartDate,
          taskIncludes
        );
        skips.push(...taskSkips);

        // Check if template includes custom columns and import them
        const templateInfoQuery = `SELECT include_custom_columns FROM custom_project_templates WHERE id = $1;`;
        const templateInfo = await db.query(templateInfoQuery, [template_id]);
        if (templateInfo.rows[0]?.include_custom_columns) {
          const customColumns = await this.getTemplateCustomColumns(template_id);
          if (customColumns && customColumns.length > 0) {
            await this.insertProjectCustomColumns(
              customColumns,
              project_id as string
            );
          }
        }
      } catch (err) {
        // Import failed partway through — remove the partially-created project
        // (FK cascades clean up phases/statuses/tasks/budget/rate card/PM rows)
        // rather than leaving an orphaned, half-configured project behind.
        await db.query(`DELETE FROM projects WHERE id = $1`, [project_id]);
        throw err;
      }

      this.logProjectCreatedFromTemplate(req.user, projectData.name);

      return res.status(200).send(
        new ServerResponse(true, {
          project_id,
          skips,
        })
      );
    }
    return res.status(200).send(new ServerResponse(true, { project_id, skips: [] }));
  }

  /**
   * Duplicate a custom project template into the caller's team library.
   * One-click: no rename prompt; name is "Copy of …" with numbering.
   */
  @HandleExceptions({
    raisedExceptions: {
      TEMPLATE_EXISTS_ERROR: `A template with the name "{0}" already exists. Please choose a different name.`,
    },
  })
  public static async duplicateCustomTemplate(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const teamId = req.user?.team_id;
    if (!id || !teamId) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Invalid request."));
    }

    const access = await ProjectTemplatesController.getCustomTemplateAccess(
      id,
      teamId
    );
    if (!access?.canManage) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Template not found."));
    }

    const data = await ProjectTemplatesController.getCustomTemplateData(id);
    if (!data) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Template not found."));
    }

    const existingNames =
      await ProjectTemplatesController.listCustomTemplateNames(teamId);
    const copyName = allocateCopyName(data.name || "Template", existingNames);

    let customColumns = null;
    const includeCustomColumns = Boolean(
      (
        await db.query(
          `SELECT include_custom_columns FROM custom_project_templates WHERE id = $1;`,
          [id]
        )
      ).rows[0]?.include_custom_columns
    );
    if (includeCustomColumns) {
      customColumns =
        await ProjectTemplatesController.getTemplateCustomColumns(id);
    }

    const newId =
      await ProjectTemplatesController.createCustomTemplateFromDefinition(
        teamId,
        {
          name: copyName,
          phase_label: data.phase_label,
          color_code: data.color_code || getColor(copyName),
          notes: data.description || null,
          phases: data.phases,
          status: data.status,
          labels: data.labels,
          tasks: data.tasks,
          includes: data.includes,
          settings: data.settings,
          include_custom_columns: includeCustomColumns,
          custom_columns: customColumns,
          schema_version: data.schema_version || 2,
        }
      );

    return res.status(200).send(
      new ServerResponse(
        true,
        { id: newId, name: copyName },
        "Template duplicated successfully."
      )
    );
  }

  /**
   * Overwrite a custom project template definition in place.
   * Does not affect projects already created from earlier saves.
   */
  @HandleExceptions({
    raisedExceptions: {
      TEMPLATE_EXISTS_ERROR: `A template with the name "{0}" already exists. Please choose a different name.`,
    },
  })
  public static async updateCustomTemplateDefinition(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const teamId = req.user?.team_id;
    if (!id || !teamId) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Invalid request."));
    }

    const access = await ProjectTemplatesController.getCustomTemplateAccess(
      id,
      teamId
    );
    if (!access?.canManage) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Template not found."));
    }

    const {
      name,
      phase_label,
      color_code,
      notes,
      description,
      phases,
      status,
      labels,
      tasks,
      includes,
      settings,
      include_custom_columns,
      custom_columns,
    } = req.body || {};

    const trimmedName =
      typeof name === "string" && name.trim() ? name.trim() : null;
    if (!trimmedName) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Template name is required."));
    }

    // Unique name within team (excluding self)
    const nameClash = await db.query(
      `SELECT id FROM custom_project_templates
       WHERE team_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3
       LIMIT 1;`,
      [teamId, trimmedName, id]
    );
    if (nameClash.rowCount) {
      return res
        .status(200)
        .send(
          new ServerResponse(
            false,
            null,
            `A template with the name "${trimmedName}" already exists. Please choose a different name.`
          )
        );
    }

    await db.query(
      `UPDATE custom_project_templates
       SET name = $1,
           phase_label = COALESCE($2, phase_label),
           color_code = COALESCE($3, color_code),
           notes = COALESCE($4, notes),
           updated_at = NOW()
       WHERE id = $5 AND team_id = $6;`,
      [
        trimmedName,
        typeof phase_label === "string" ? phase_label : null,
        typeof color_code === "string" ? color_code : null,
        typeof notes === "string"
          ? notes
          : typeof description === "string"
            ? description
            : null,
        id,
        teamId,
      ]
    );

    const hasDefinitionPayload =
      Array.isArray(phases) ||
      Array.isArray(status) ||
      Array.isArray(tasks) ||
      Array.isArray(labels) ||
      includes !== undefined ||
      settings !== undefined ||
      custom_columns !== undefined;

    if (hasDefinitionPayload) {
      await ProjectTemplatesController.clearCustomTemplateChildren(id);
      await ProjectTemplatesController.persistCustomTemplateChildren(
        id,
        teamId,
        {
          phases: Array.isArray(phases) ? phases : [],
          status: Array.isArray(status) ? status : [],
          labels: Array.isArray(labels) ? labels : [],
          tasks: Array.isArray(tasks) ? tasks : [],
          includes,
          settings,
          include_custom_columns: Boolean(include_custom_columns),
          custom_columns: Array.isArray(custom_columns) ? custom_columns : [],
        }
      );
    }

    return res.status(200).send(
      new ServerResponse(
        true,
        { id, name: trimmedName },
        "Template updated successfully."
      )
    );
  }

  /**
   * Create a custom project template from a built-in (worklenz) template,
   * optionally with an edited definition payload (Copy & Customize save).
   * Never mutates the built-in catalog.
   */
  @HandleExceptions({
    raisedExceptions: {
      TEMPLATE_EXISTS_ERROR: `A template with the name "{0}" already exists. Please choose a different name.`,
    },
  })
  public static async createCustomFromWorklenzTemplate(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) {
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Invalid request."));
    }

    const {
      worklenz_template_id,
      templateName,
      name,
      phase_label,
      color_code,
      notes,
      description,
      phases,
      status,
      labels,
      tasks,
      includes,
      settings,
    } = req.body || {};

    if (!worklenz_template_id || typeof worklenz_template_id !== "string") {
      return res
        .status(400)
        .send(
          new ServerResponse(false, null, "worklenz_template_id is required.")
        );
    }

    const existingNames =
      await ProjectTemplatesController.listCustomTemplateNames(teamId);

    const hasEditedDefinition =
      Array.isArray(phases) ||
      Array.isArray(status) ||
      Array.isArray(tasks) ||
      Array.isArray(labels);

    const preferredName =
      (typeof templateName === "string" && templateName.trim()) ||
      (typeof name === "string" && name.trim()) ||
      null;

    const definition =
      await ProjectTemplatesController.buildDefinitionFromWorklenzTemplate(
        worklenz_template_id,
        hasEditedDefinition
          ? {
              name: preferredName || undefined,
              phase_label,
              color_code,
              notes:
                typeof notes === "string"
                  ? notes
                  : typeof description === "string"
                    ? description
                    : undefined,
              phases,
              status,
              labels,
              tasks,
              includes,
              settings,
            }
          : preferredName
            ? { name: preferredName }
            : undefined
      );

    if (!definition) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Template not found."));
    }

    // Default name: "Copy of {built-in}" when caller did not supply one
    if (!preferredName) {
      definition.name = allocateCopyName(definition.name, existingNames);
    } else {
      definition.name = preferredName;
    }

    const newId =
      await ProjectTemplatesController.createCustomTemplateFromDefinition(
        teamId,
        {
          ...definition,
          notes: definition.notes,
        }
      );

    return res.status(200).send(
      new ServerResponse(
        true,
        { id: newId, name: definition.name },
        "Template saved as a copy successfully."
      )
    );
  }
}
