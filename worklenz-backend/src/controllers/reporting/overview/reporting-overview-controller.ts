import HandleExceptions from "../../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";
import { formatDuration, formatLogText, getColor, int } from "../../../shared/utils";
import ReportingOverviewBase from "./reporting-overview-base";
import { GroupBy, ITaskGroup } from "../../tasks-controller-base";
import TasksControllerV2, { TaskListGroup } from "../../tasks-controller-v2";
import { TASK_PRIORITY_COLOR_ALPHA } from "../../../shared/constants";
import { ReportingExportModel } from "../../../models/reporting-export";
import moment from "moment";
import ReportingControllerBase from "../reporting-controller-base";

export default class ReportingOverviewController extends ReportingOverviewBase {
  @HandleExceptions()
  public static async getStatistics(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = this.getCurrentTeamId(req);
    const includeArchived = req.query.archived === "true";

    const archivedClause = includeArchived
      ? ""
      : `AND projects.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = projects.id AND user_id = '${req.user?.id}') `;

    const teams = await this.getTeamsCounts(teamId, archivedClause);
    const projects = await this.getProjectsCounts(teamId, archivedClause);
    const members = await this.getMemberCounts(teamId);

    projects.count = teams.projects;
    members.count = teams.members;

    const body = {
      teams,
      projects,
      members
    };

    return res.status(200).send(new ServerResponse(true, body));
  }

  @HandleExceptions()
  public static async getTeams(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = this.getCurrentTeamId(req);
    const includeArchived = req.query.archived === "true";

    const archivedClause = includeArchived
      ? ""
      : `AND id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = projects.id AND archived_projects.user_id = '${req.user?.id}')`;

    const q = `
      SELECT id,
             name,
             COALESCE((SELECT COUNT(*) FROM projects WHERE team_id = teams.id ${archivedClause}), 0) AS projects_count,
             (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
              FROM (
                     --
                     SELECT (SELECT name
                             FROM team_member_info_view
                             WHERE team_member_info_view.team_member_id = tm.id),
                            u.avatar_url
                     FROM team_members tm
                            LEFT JOIN users u ON tm.user_id = u.id
                     WHERE team_id = teams.id
                     --
                   ) rec) AS members
      FROM teams
      WHERE in_organization(id, $1)
      ORDER BY name;
    `;
    const result = await db.query(q, [teamId]);

    for (const team of result.rows) {
      team.members = this.createTagList(team?.members);
      team.members.map((a: any) => a.color_code = getColor(a.name));
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { searchQuery, sortField, sortOrder, size, offset } = this.toPaginationOptions(req.query, ["p.name"]);
    const archived = req.query.archived === "true";

    const teamId = req.query.team as string;

    const archivedClause = archived
      ? ""
      : `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = '${req.user?.id}') `;

    const teamFilterClause = `p.team_id = $1`;

    const result = await ReportingControllerBase.getProjectsByTeam(teamId, size, offset, searchQuery, sortField, sortOrder, "", "", "", archivedClause, teamFilterClause, "");


    for (const project of result.projects) {
      project.team_color = getColor(project.team_name) + TASK_PRIORITY_COLOR_ALPHA;
      project.days_left = ReportingControllerBase.getDaysLeft(project.end_date);
      project.is_overdue = ReportingControllerBase.isOverdue(project.end_date);
      if (project.days_left && project.is_overdue) {
        project.days_left = project.days_left.toString().replace(/-/g, "");
      }
      project.is_today = this.isToday(project.end_date);
      project.estimated_time = int(project.estimated_time);
      project.actual_time = int(project.actual_time);
      project.estimated_time_string = this.convertMinutesToHoursAndMinutes(int(project.estimated_time));
      project.actual_time_string = this.convertSecondsToHoursAndMinutes(int(project.actual_time));
      project.tasks_stat = {
        todo: this.getPercentage(int(project.tasks_stat.todo), +project.tasks_stat.total),
        doing: this.getPercentage(int(project.tasks_stat.doing), +project.tasks_stat.total),
        done: this.getPercentage(int(project.tasks_stat.done), +project.tasks_stat.total)
      };
      if (project.update.length > 0) {
        const update = project.update[0];
        const placeHolders = update.content.match(/{\d+}/g);
        if (placeHolders) {
          placeHolders.forEach((placeHolder: { match: (arg0: RegExp) => string[]; }) => {
            const index = parseInt(placeHolder.match(/\d+/)[0]);
            if (index >= 0 && index < update.mentions.length) {
              update.content = update.content.replace(placeHolder, `
                  <span class='mentions'> @${update.mentions[index].user_name} </span>`);
            }
          });
        }
        project.comment = update.content;
      }
      if (project.last_activity) {
        if (project.last_activity.attribute_type === "estimation") {
          project.last_activity.previous = formatDuration(moment.duration(project.last_activity.previous, "minutes"));
          project.last_activity.current = formatDuration(moment.duration(project.last_activity.current, "minutes"));
        }
        if (project.last_activity.assigned_user) project.last_activity.assigned_user.color_code = getColor(project.last_activity.assigned_user.name);
        project.last_activity.done_by.color_code = getColor(project.last_activity.done_by.name);
        project.last_activity.log_text = await formatLogText(project.last_activity);
        project.last_activity.attribute_type = project.last_activity.attribute_type?.replace(/_/g, " ");
        project.last_activity.last_activity_string = `${project.last_activity.done_by.name} ${project.last_activity.log_text} ${project.last_activity.attribute_type}`;
      }
    }

    return res.status(200).send(new ServerResponse(true, result));
  }

  @HandleExceptions()
  public static async getProjectsByTeamOrMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.params.team_id?.trim() || null;
    const teamMemberId = (req.query.member as string)?.trim() || null;
    const teamMemberFilter = teamId === "undefined" ? `AND pm.team_member_id = $1` : teamMemberId ? `AND pm.team_member_id = $2` : "";
    const teamIdFilter = teamId === "undefined" ? "p.team_id IS NOT NULL" : `p.team_id = $1`;

    const q = `
        SELECT  p.id,
              p.name,
              p.color_code,
              p.team_id,
              p.status_id
        FROM projects p
            LEFT JOIN project_members pm ON pm.project_id = p.id
        WHERE ${teamIdFilter} ${teamMemberFilter}
        GROUP BY p.id, p.name;`;

    const params = teamId === "undefined" ? [teamMemberId] : teamMemberId ? [teamId, teamMemberId] : [teamId];

    const result = await db.query(q, params);

    const data = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getMembersByTeam(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.params.team_id?.trim() || null;
    const archived = req.query.archived === "true";

    const pmArchivedClause = archived ? `` : `AND project_members.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = project_members.project_id AND user_id = '${req.user?.id}')`;
    const taArchivedClause = archived ? `` : `AND (SELECT tasks.project_id FROM tasks WHERE tasks.id = tasks_assignees.task_id) NOT IN (SELECT project_id FROM archived_projects WHERE project_id = (SELECT tasks.project_id FROM tasks WHERE tasks.id = tasks_assignees.task_id) AND user_id = '${req.user?.id}')`;

    const q = `
      SELECT team_member_id AS id,
             name,
             email,

             (SELECT COUNT(*)
              FROM project_members
              WHERE project_members.team_member_id = team_member_info_view.team_member_id ${pmArchivedClause}) AS projects,

             (SELECT COUNT(*)
              FROM tasks_assignees
              WHERE tasks_assignees.team_member_id = team_member_info_view.team_member_id ${taArchivedClause}) AS tasks,

             (SELECT COUNT(*)
              FROM tasks_assignees
              WHERE tasks_assignees.team_member_id = team_member_info_view.team_member_id
                AND is_overdue(task_id) IS TRUE ${taArchivedClause}) AS overdue,

             (SELECT COUNT(*)
              FROM tasks_assignees
              WHERE tasks_assignees.team_member_id = team_member_info_view.team_member_id
                AND task_id IN (SELECT id
                                FROM tasks
                                WHERE is_completed(tasks.status_id, tasks.project_id)) ${taArchivedClause}) AS completed,

             (SELECT COUNT(*)
              FROM tasks_assignees
              WHERE tasks_assignees.team_member_id = team_member_info_view.team_member_id
                AND task_id IN (SELECT id
                                FROM tasks
                                WHERE is_doing(tasks.status_id, tasks.project_id)) ${taArchivedClause}) AS ongoing

      FROM team_member_info_view
      WHERE team_id = $1
      ORDER BY name;
    `;

    const result = await db.query(q, [teamId]);

    for (const member of result.rows) {
      member.projects = int(member.projects);
      member.tasks = int(member.tasks);
      member.overdue = int(member.overdue);
      member.completed = int(member.completed);
      member.ongoing = int(member.ongoing);
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getProjectOverview(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.params.project_id || null;

    const stats = await this.getProjectStats(projectId);
    const byStatus = await this.getTasksByStatus(projectId);
    const byPriority = await this.getTasksByPriority(projectId);
    const byDue = await this.getTaskCountsByDue(projectId);

    byPriority.all = byStatus.all;

    byDue.all = byStatus.all;
    byDue.completed = stats.completed;
    byDue.overdue = stats.overdue;

    const body = {
      stats,
      by_status: byStatus,
      by_priority: byPriority,
      by_due: byDue
    };

    this.createByStatusChartData(body.by_status);
    this.createByPriorityChartData(body.by_priority);
    this.createByDueDateChartData(body.by_due);

    return res.status(200).send(new ServerResponse(true, body));
  }

  @HandleExceptions()
  public static async getProjectMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.params.project_id?.trim() || null;

    const members = await ReportingExportModel.getProjectMembers(projectId as string);

    return res.status(200).send(new ServerResponse(true, members));
  }

  @HandleExceptions()
  public static async getProjectTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const groupBy = (req.query.group || GroupBy.STATUS) as string;
    const projectId = req.params.project_id?.trim() || null;

    const groups = await TasksControllerV2.getGroups(groupBy, projectId as string);
    const tasks = await this.getAllTasks(projectId);

    const map = groups.reduce((g: { [x: string]: ITaskGroup }, group) => {
      if (group.id)
        g[group.id] = new TaskListGroup(group);
      return g;
    }, {});

    TasksControllerV2.updateMapByGroup(tasks, groupBy, map);
    const updatedGroups = Object.keys(map).map(key => {
      const group = map[key];
      if (groupBy === GroupBy.PHASE)
        group.color_code = getColor(group.name) + TASK_PRIORITY_COLOR_ALPHA;
      return {
        id: key,
        ...group
      };
    });

    return res.status(200).send(new ServerResponse(true, updatedGroups));
  }

  @HandleExceptions()
  public static async getTeamMemberOverview(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamMemberId = req.query.teamMemberId as string;
    const archived = req.query.archived === "true";

    const stats = await this.getTeamMemberStats(teamMemberId, archived, req.user?.id as string);
    const byStatus = await this.getTasksByStatusOfTeamMemberOverview(teamMemberId, archived, req.user?.id as string);
    const byProject = await this.getTasksByProjectOfTeamMemberOverview(teamMemberId, archived, req.user?.id as string);
    const byPriority = await this.getTasksByPriorityOfTeamMemberOverview(teamMemberId, archived, req.user?.id as string);

    stats.projects = await this.getProjectCountOfTeamMember(teamMemberId, archived, req.user?.id as string);

    const body = {
      stats,
      by_status: byStatus,
      by_project: byProject,
      by_priority: byPriority
    };

    return res.status(200).send(new ServerResponse(true, body));
  }

  @HandleExceptions()
  public static async getMemberOverview(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamMemberId = req.query.teamMemberId as string;
    const { duration, date_range } = req.query;
    const archived = req.query.archived === "true";

    let dateRange: string[] = [];
    if (typeof date_range === "string") {
      dateRange = date_range.split(",");
    }

    const stats = await this.getMemberStats(teamMemberId, duration as string, dateRange, archived, req.user?.id as string);
    const byStatus = await this.getTasksByStatusOfTeamMember(teamMemberId, duration as string, dateRange, archived, req.user?.id as string);
    const byProject = await this.getTasksByProjectOfTeamMember(teamMemberId, duration as string, dateRange, archived, req.user?.id as string);
    const byPriority = await this.getTasksByPriorityOfTeamMember(teamMemberId, duration as string, dateRange, archived, req.user?.id as string);

    stats.teams = await this.getTeamCountOfTeamMember(teamMemberId);
    stats.projects = await this.getProjectCountOfTeamMember(teamMemberId, archived, req.user?.id as string);

    const body = {
      stats,
      by_status: byStatus,
      by_project: byProject,
      by_priority: byPriority
    };

    return res.status(200).send(new ServerResponse(true, body));
  }

  @HandleExceptions()
  public static async getMemberTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamMemberId = req.params.team_member_id?.trim() || null;
    const projectId = (req.query.project as string)?.trim() || null;
    const onlySingleMember = req.query.only_single_member as string;
    const { duration, date_range } = req.query;
    const includeArchived = req.query.archived === "true";

    let dateRange: string[] = [];
    if (typeof date_range === "string") {
      dateRange = date_range.split(",");
    }

    const results = await ReportingExportModel.getMemberTasks(teamMemberId as string, projectId, onlySingleMember, duration as string, dateRange, includeArchived, req.user?.id as string);

    return res.status(200).send(new ServerResponse(true, results));
  }

  @HandleExceptions()
  public static async getTeamOverview(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.params.team_id || null;
    const archived = req.query.archived === "true";

    const archivedClause = await this.getArchivedProjectsClause(archived, req.user?.id as string, "projects.id");

    const byStatus = await this.getProjectsByStatus(teamId, archivedClause);
    const byCategory = await this.getProjectsByCategory(teamId, archivedClause);
    const byHealth = await this.getProjectsByHealth(teamId, archivedClause);

    byCategory.all = byStatus.all;
    byHealth.all = byStatus.all;

    const body = {
      by_status: byStatus,
      by_category: byCategory,
      by_health: byHealth
    };

    this.createByProjectStatusChartData(body.by_status);
    this.createByProjectHealthChartData(body.by_health);

    return res.status(200).send(new ServerResponse(true, body));

  }


}
