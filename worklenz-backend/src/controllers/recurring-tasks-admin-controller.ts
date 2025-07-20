import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { RecurringTasksPermissions } from "../utils/recurring-tasks-permissions";
import { RecurringTasksAuditLogger } from "../utils/recurring-tasks-audit-logger";

export default class RecurringTasksAdminController extends WorklenzControllerBase {
  /**
   * Get templates with permission issues
   */
  @HandleExceptions()
  public static async getPermissionIssues(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const issues = await RecurringTasksPermissions.getTemplatesWithPermissionIssues();
    return res.status(200).send(new ServerResponse(true, issues));
  }

  /**
   * Get audit log summary
   */
  @HandleExceptions()
  public static async getAuditSummary(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { days = 7 } = req.query;
    const summary = await RecurringTasksAuditLogger.getAuditSummary(Number(days));
    return res.status(200).send(new ServerResponse(true, summary));
  }

  /**
   * Get recent errors from audit log
   */
  @HandleExceptions()
  public static async getRecentErrors(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { limit = 10 } = req.query;
    const errors = await RecurringTasksAuditLogger.getRecentErrors(Number(limit));
    return res.status(200).send(new ServerResponse(true, errors));
  }

  /**
   * Validate a specific template
   */
  @HandleExceptions()
  public static async validateTemplate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { templateId } = req.params;
    const result = await RecurringTasksPermissions.validateTemplatePermissions(templateId);
    return res.status(200).send(new ServerResponse(true, result));
  }
}