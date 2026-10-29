import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  TemplateServiceError,
  VELOCITY_REPORT_KIND,
  createTemplate,
  deleteTemplate,
  listTemplates,
  renameTemplate,
  setDefaultTemplate,
  setTemplateShare,
} from "../../services/reporting-analytics/analytics-templates.service";

function sendTemplateError(res: IWorkLenzResponse, error: unknown): IWorkLenzResponse | null {
  if (error instanceof TemplateServiceError) {
    return res
      .status(error.statusCode)
      .send(new ServerResponse(false, null, error.message));
  }
  return null;
}

export default class AnalyticsTemplatesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async list(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const kind =
      typeof req.query.report_kind === "string" && req.query.report_kind
        ? req.query.report_kind
        : "all";

    const rows = await listTemplates(teamId, userId, kind);
    return res.status(200).send(new ServerResponse(true, rows));
  }

  @HandleExceptions()
  public static async create(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const body = req.body ?? {};
      const row = await createTemplate(req.user, {
        name: body.name,
        filters: body.filters,
        isWorkspaceShared: !!body.is_workspace_shared,
        isDefault: !!body.is_default,
        reportKind: body.report_kind ?? VELOCITY_REPORT_KIND,
      });
      return res.status(201).send(new ServerResponse(true, row));
    } catch (error) {
      const handled = sendTemplateError(res, error);
      if (handled) return handled;
      throw error;
    }
  }

  @HandleExceptions()
  public static async rename(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const row = await renameTemplate(
        req.user,
        String(req.params.id),
        req.body?.name
      );
      return res.status(200).send(new ServerResponse(true, row));
    } catch (error) {
      const handled = sendTemplateError(res, error);
      if (handled) return handled;
      throw error;
    }
  }

  @HandleExceptions()
  public static async remove(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      await deleteTemplate(req.user, String(req.params.id));
      return res.status(200).send(new ServerResponse(true, null, "Deleted"));
    } catch (error) {
      const handled = sendTemplateError(res, error);
      if (handled) return handled;
      throw error;
    }
  }

  @HandleExceptions()
  public static async setDefault(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const row = await setDefaultTemplate(req.user, String(req.params.id));
      return res.status(200).send(new ServerResponse(true, row));
    } catch (error) {
      const handled = sendTemplateError(res, error);
      if (handled) return handled;
      throw error;
    }
  }

  @HandleExceptions()
  public static async setShare(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    try {
      const row = await setTemplateShare(
        req.user,
        String(req.params.id),
        !!req.body?.is_workspace_shared
      );
      return res.status(200).send(new ServerResponse(true, row));
    } catch (error) {
      const handled = sendTemplateError(res, error);
      if (handled) return handled;
      throw error;
    }
  }
}
