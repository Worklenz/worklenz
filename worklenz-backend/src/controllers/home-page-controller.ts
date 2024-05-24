import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import { TaskService } from "../services/tasks";
import { ProjectService } from "../services/projects";
import { GROUP_BY_ASSIGNED_TO_ME, ALL_TAB } from "../shared/constants";
import { CreatePersonalTaskDto } from "../dtos";

interface ITask {
  id: string,
  name: string,
  project_id: string,
  parent_task_id: string | null,
  is_sub_task: boolean,
  parent_task_name: string | null,
  status_id: string,
  start_date: string | null,
  end_date: string | null,
  created_at: string | null,
  team_id: string,
  project_name: string,
  project_color: string | null,
  status: string,
  status_color: string | null,
  is_task: boolean,
  done: boolean,
  updated_at: string | null,
  project_statuses: [{
    id: string,
    name: string | null,
    color_code: string | null,
  }]
}

export default class HomePageController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async createPersonalTask(request: IWorkLenzRequest, response: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const payload : CreatePersonalTaskDto = {
      name: request.body.name,
      color_code: request.body.color,
      user_id: request.user?.id
    };
    const result = await TaskService.createPersonalTask(payload);
    const [data] = result.rows;
    return response.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getTasks(request: IWorkLenzRequest, response: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = request.user?.team_id;
    const userId = request.user?.id;
    const timeZone = request.query.time_zone as string;
    const today = new Date();
    const isCalendarView = request.query.is_calendar_view;
    const selectedDate = request.query.selected_date;

    const currentGroup = TaskService.isValidGroup(request.query.group_by as string) ? request.query.group_by : GROUP_BY_ASSIGNED_TO_ME;
    const currentTab = TaskService.isValidView(request.query.current_tab as string) ? request.query.current_tab : ALL_TAB;
    const groupByClosure = TaskService.getTasksByGroupClosure(currentGroup);
    let currentTabClosure = TaskService.getTasksByTabClosure(currentTab as string);
    let result = await TaskService.getTasksResult(groupByClosure, currentTabClosure, teamId as string, userId as string);
    let tasks: ITask[] = result.rows; 
    const counts = await TaskService.getTaskCountsByGroup(tasks, timeZone, today);
    
    if (isCalendarView == "true") {
      currentTabClosure = `AND t.end_date::DATE = '${selectedDate}'`;
      tasks = await TaskService.getTaskGroupBySingleDate(tasks, timeZone, selectedDate as string);
    } else {
      tasks = await TaskService.getTasksGroupByDate(currentTab as string, tasks, timeZone, today);
    }

    // const counts = await TaskService.getCountsResult(groupByClosure, teamId as string, userId as string);

    const data = {
      tasks: tasks,
      total: counts.total,
      today: counts.today,
      upcoming: counts.upcoming,
      overdue: counts.overdue,
      no_due_date: counts.no_due_date,
    };

    return response.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getPersonalTasks(request: IWorkLenzRequest, response: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const user_id = request.user?.id;
    const results = await TaskService.getPersonalTasks(user_id);
    return response.status(200).send(new ServerResponse(true, results.rows));
  }

  @HandleExceptions()
  public static async getProjects(request: IWorkLenzRequest, response: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const team_id = request.user?.team_id;
    const user_id = request.user?.id;
    const current_view = request.query.view;
    const filter = request.query.filter;
    const result = await ProjectService.getProjects(team_id, user_id, current_view, filter);
    return response.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getProjectsByTeam(request: IWorkLenzRequest, response: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const team_id = request.user?.team_id;
    const user_id = request.user?.id;
    const result = await ProjectService.getProjectsByTeam(team_id, user_id);
    return response.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updatePersonalTask(request: IWorkLenzRequest, response: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    await TaskService.updatePersonalTask(request.body.id);
    return response.status(200).send(new ServerResponse(true, request.body.id));
  }
}
