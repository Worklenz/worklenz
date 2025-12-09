import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

interface ITaskAssignee {
  team_member_id: string;
  project_member_id: string;
  name: string;
  email_notifications_enabled: string;
  avatar_url: string;
  user_id: string;
  email: string;
  socket_id: string;
  team_id: string;
  user_name: string;
}

interface IMailConfig {
  message: string;
  receiverEmail: string;
  receiverName: string;
  content: string;
  commentId: string;
  projectId: string;
  taskId: string;
  teamName: string;
  projectName: string;
  taskName: string;
}

interface IMention {
  team_member_id: string;
  name: string;
}

export default class TaskDuplicateController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async duplicate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // req.body.user_id = req.user?.id;
    const taskId = req.body.task_id;
    const projectId = req.body.project_id;
    const options = req.body.options;
    // req.body.team_id = req.user?.team_id;
    console.log("Task Duplicate Req Body:", req.body);
    // req.body.content = commentContent;

    

    return res.status(200).send(new ServerResponse(true, null, "Task duplicated successfully"));
  }
}
