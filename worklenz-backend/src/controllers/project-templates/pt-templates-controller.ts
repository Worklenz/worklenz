import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import HandleExceptions from "../../decorators/handle-exceptions";
import { templateData } from "./project-templates";
import ProjectTemplatesControllerBase from "./project-templates-base";
import { LOG_DESCRIPTIONS, TASK_PRIORITY_COLOR_ALPHA, TASK_STATUS_COLOR_ALPHA } from "../../shared/constants";
import { IO } from "../../shared/io";

export default class ProjectTemplatesController extends ProjectTemplatesControllerBase {

    @HandleExceptions()
    public static async getTemplates(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const q = `SELECT id, name FROM pt_project_templates ORDER BY name;`;
        const result = await db.query(q, []);
        return res.status(200).send(new ServerResponse(true, result.rows));
    }

    @HandleExceptions()
    public static async getCustomTemplates(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { searchQuery } = this.toPaginationOptions(req.query, "name");

        const q = `SELECT id, name, created_at, FALSE AS selected FROM custom_project_templates WHERE team_id = $1 ${searchQuery} ORDER BY name;`;
        const result = await db.query(q, [req.user?.team_id]);
        return res.status(200).send(new ServerResponse(true, result.rows));
    }

    @HandleExceptions()
    public static async deleteCustomTemplate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { id } = req.params;

        const q = `DELETE FROM custom_project_templates WHERE id = $1;`;
        await db.query(q, [id]);
        return res.status(200).send(new ServerResponse(true, [], "Template deleted successfully."));
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
    public static async getTemplateById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { id } = req.params;
        const data = await this.getTemplateData(id);

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
    public static async createTemplates(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
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
    public static async importTemplates(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { template_id } = req.body;
        let project_id: string | null = null;

        const data = await this.getTemplateData(template_id);
        if (data) {
            data.team_id = req.user?.team_id || null;
            data.user_id = req.user?.id || null;
            data.folder_id = null;
            data.category_id = null;
            data.status_id = await this.getDefaultProjectStatus();
            data.project_created_log = LOG_DESCRIPTIONS.PROJECT_CREATED;
            data.project_member_added_log = LOG_DESCRIPTIONS.PROJECT_MEMBER_ADDED;
            data.health_id = await this.getDefaultProjectHealth();
            data.working_days = 0;
            data.man_days = 0;
            data.hours_per_day = 8;

            project_id = await this.importTemplate(data);

            await this.insertTeamLabels(data.labels, req.user?.team_id);
            await this.insertProjectPhases(data.phases, project_id as string);
            await this.insertProjectTasks(data.tasks, data.team_id, project_id as string, data.user_id, IO.getSocketById(req.user?.socket_id as string));

            return res.status(200).send(new ServerResponse(true, { project_id }));
        }
        return res.status(200).send(new ServerResponse(true, { project_id }));
    }

    @HandleExceptions({
        raisedExceptions: {
            "TEMPLATE_EXISTS_ERROR": `A template with the name "{0}" already exists. Please choose a different name.`
        }
    })
    public static async createCustomTemplate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { project_id, templateName, projectIncludes, taskIncludes } = req.body;
        const team_id = req.user?.team_id || null;

        if (!team_id || !project_id) return res.status(400).send(new ServerResponse(false, {}));


        let status, labels, phases = [];

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

        const tasks = await this.getTasksByProject(project_id, taskIncludes);

        data.name = templateName;
        data.team_id = team_id;

        const q = `SELECT create_project_template($1);`;
        const result = await db.query(q, [JSON.stringify(data)]);
        const [obj] = result.rows;

        const template_id = obj.create_project_template.id;

        if (template_id) {
            if (phases) await this.insertCustomTemplatePhases(phases, template_id);
            if (status) await this.insertCustomTemplateStatus(status, template_id, team_id);
            if (tasks) await this.insertCustomTemplateTasks(tasks, template_id, team_id);
        }

        return res.status(200).send(new ServerResponse(true, {}, "Project template created successfully."));
    }

    @HandleExceptions()
    public static async setupAccount(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { template_id, team_name } = req.body;
        let project_id: string | null = null;

        await this.updateTeamName(team_name, req.user?.team_id as string, req.user?.id as string);

        const data = await this.getTemplateData(template_id);
        if (data) {
            data.team_id = req.user?.team_id || null;
            data.user_id = req.user?.id || null;
            data.folder_id = null;
            data.category_id = null;
            data.status_id = await this.getDefaultProjectStatus();
            data.project_created_log = LOG_DESCRIPTIONS.PROJECT_CREATED;
            data.project_member_added_log = LOG_DESCRIPTIONS.PROJECT_MEMBER_ADDED;
            data.health_id = await this.getDefaultProjectHealth();
            data.working_days = 0;
            data.man_days = 0;
            data.hours_per_day = 8;

            project_id = await this.importTemplate(data);

            await this.insertTeamLabels(data.labels, req.user?.team_id);
            await this.insertProjectPhases(data.phases, project_id as string);
            await this.insertProjectTasks(data.tasks, data.team_id, project_id as string, data.user_id, IO.getSocketById(req.user?.socket_id as string));

            await this.handleAccountSetup(project_id as string, data.user_id, team_name);

            return res.status(200).send(new ServerResponse(true, { id: project_id }));
        }
        return res.status(200).send(new ServerResponse(true, { id: project_id }));
    }

    @HandleExceptions()
    public static async importCustomTemplate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { template_id } = req.body;
        let project_id: string | null = null;

        const data = await this.getCustomTemplateData(template_id);
        if (data) {
            data.team_id = req.user?.team_id || null;
            data.user_id = req.user?.id || null;
            data.folder_id = null;
            data.category_id = null;
            data.status_id = await this.getDefaultProjectStatus();
            data.project_created_log = LOG_DESCRIPTIONS.PROJECT_CREATED;
            data.project_member_added_log = LOG_DESCRIPTIONS.PROJECT_MEMBER_ADDED;
            data.working_days = 0;
            data.man_days = 0;
            data.hours_per_day = 8;

            project_id = await this.importTemplate(data);

            await this.deleteDefaultStatusForProject(project_id as string);
            await this.insertTeamLabels(data.labels, req.user?.team_id);
            await this.insertProjectPhases(data.phases, project_id as string);
            await this.insertProjectStatuses(data.status, project_id as string, data.team_id );
            await this.insertProjectTasksFromCustom(data.tasks, data.team_id, project_id as string, data.user_id,  IO.getSocketById(req.user?.socket_id as string));

            return res.status(200).send(new ServerResponse(true, { project_id }));
        }
        return res.status(200).send(new ServerResponse(true, { project_id }));
    }
}
