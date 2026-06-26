import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { LOG_DESCRIPTIONS } from "../shared/constants";
import { IO } from "../shared/io";
import ProjectTemplatesControllerBase from "./project-templates/project-templates-base";

interface ISetupAccountFromTemplateBody {
  template_id?: string;
  team_name?: string;
  project_name?: string | null;
}

export default class OnboardingController extends ProjectTemplatesControllerBase {
  @HandleExceptions()
  private static async getDefaultProjectStatusId() {
    const q = `SELECT id FROM sys_project_statuses WHERE is_default IS TRUE LIMIT 1;`;
    const result = await db.query(q, []);
    return result.rows[0]?.id ?? null;
  }

  @HandleExceptions()
  private static async getDefaultProjectHealthId() {
    const q = `SELECT id FROM sys_project_healths WHERE is_default IS TRUE LIMIT 1;`;
    const result = await db.query(q, []);
    return result.rows[0]?.id ?? null;
  }

  @HandleExceptions()
  public static async setupAccountFromTemplate(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse,
  ): Promise<IWorkLenzResponse> {
    const { template_id, team_name, project_name } =
      (req.body || {}) as ISetupAccountFromTemplateBody;

    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    if (!userId || !teamId) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Session is invalid. Please sign in again."));
    }

    if (!template_id || typeof template_id !== "string") {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Template ID is required."));
    }

    const safeTeamName = (team_name || "").trim();
    if (!safeTeamName) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Team name is required."));
    }

    const templateData = await this.getTemplateData(template_id);
    if (!templateData) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Template not found."));
    }

    const tasks = Array.isArray(templateData.tasks) ? templateData.tasks : [];
    const phases = Array.isArray(templateData.phases) ? templateData.phases : [];
    const labels = Array.isArray(templateData.labels) ? templateData.labels : [];

    const defaultStatusId = await this.getDefaultProjectStatusId();
    const defaultHealthId = await this.getDefaultProjectHealthId();

    if (!defaultStatusId || !defaultHealthId) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Project defaults are missing. Please contact support."));
    }

    const safeProjectName = typeof project_name === "string" ? project_name.trim() : "";

    const projectData: any = {
      name: safeProjectName || templateData.name,
      notes: templateData.description,
      phase_label: templateData.phase_label,
      color_code: templateData.color_code,
      image_url: templateData.image_url,
      team_id: teamId,
      user_id: userId,
      folder_id: null,
      category_id: null,
      status_id: defaultStatusId,
      project_created_log: LOG_DESCRIPTIONS.PROJECT_CREATED,
      project_member_added_log: LOG_DESCRIPTIONS.PROJECT_MEMBER_ADDED,
      health_id: defaultHealthId,
      working_days: 0,
      man_days: 0,
      hours_per_day: 8,
    };

    const projectId = await this.importTemplate(projectData);

    await this.updateTeamName(safeTeamName, teamId, userId);
    await this.insertTeamLabels(labels, teamId);
    await this.insertProjectPhases(phases, projectId as string);
    await this.insertProjectTasks(
      tasks,
      teamId,
      projectId as string,
      userId,
      IO.getSocketById(req.user?.socket_id as string),
    );

    await this.handleAccountSetup(projectId as string, userId, safeTeamName);

    return res.status(200).send(new ServerResponse(true, { id: projectId }));
  }
}
