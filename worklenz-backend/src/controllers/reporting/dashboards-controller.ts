import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { InvalidDashboardError } from "../../services/dashboard-validation";
import {
  createDashboard,
  DashboardNotFoundError,
  deleteDashboard,
  getDashboard,
  getDashboardByShareToken,
  listDashboards,
  rotateShareToken,
  saveDashboardGadgets,
  updateDashboard,
  viewerFromRequestUser,
} from "../../services/dashboards.service";

/**
 * Reporting & Analytics > Custom Dashboards (spec: Worklenz/worklenz-business#2558).
 * Mounted under /reporting/dashboards. Validation and access rules live in the services.
 */
export default class DashboardsController extends WorklenzControllerBase {
  /** Runs `work`, turning the services' expected failures into 400 / 404 responses. */
  private static async respond(
    res: IWorkLenzResponse,
    work: () => Promise<unknown>,
    { status = 200, message }: { status?: number; message?: string } = {}
  ): Promise<IWorkLenzResponse> {
    try {
      return res.status(status).send(new ServerResponse(true, await work(), message));
    } catch (error) {
      if (error instanceof InvalidDashboardError) return res.status(400).send(new ServerResponse(false, null, error.message));
      if (error instanceof DashboardNotFoundError) return res.status(404).send(new ServerResponse(false, null, error.message));
      throw error;
    }
  }

  /** GET /reporting/dashboards - the caller's dashboards plus those shared with them. */
  @HandleExceptions()
  public static async list(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return DashboardsController.respond(res, () => listDashboards(req.user?.team_id as string, viewerFromRequestUser(req.user)));
  }

  /** GET /reporting/dashboards/:id */
  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return DashboardsController.respond(res, () => getDashboard(req.user?.team_id as string, req.params.id, viewerFromRequestUser(req.user)));
  }

  /** GET /reporting/dashboards/shared/:token - open a link-shared dashboard (still requires team membership). */
  @HandleExceptions()
  public static async getShared(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return DashboardsController.respond(res, () => getDashboardByShareToken(req.user?.team_id as string, req.params.token, viewerFromRequestUser(req.user)));
  }

  /** POST /reporting/dashboards - body: { name, description?, visibility?, visible_roles?, filters?, gadgets? } */
  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return DashboardsController.respond(res, () => createDashboard(req.user?.team_id as string, viewerFromRequestUser(req.user), req.body), {
      status: 201,
      message: "Dashboard created",
    });
  }

  /** PATCH /reporting/dashboards/:id - any of name, description, visibility, visible_roles, filters. */
  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return DashboardsController.respond(res, () => updateDashboard(req.user?.team_id as string, req.params.id, viewerFromRequestUser(req.user), req.body), {
      message: "Dashboard updated",
    });
  }

  /** PUT /reporting/dashboards/:id/gadgets - body: { gadgets: [{ type, x, y, w, h, config }] } replaces the whole set. */
  @HandleExceptions()
  public static async saveGadgets(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return DashboardsController.respond(res, () => saveDashboardGadgets(req.user?.team_id as string, req.params.id, viewerFromRequestUser(req.user), req.body?.gadgets), {
      message: "Dashboard saved",
    });
  }

  /** POST /reporting/dashboards/:id/share-token/rotate - invalidates the old link. */
  @HandleExceptions()
  public static async rotateToken(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return DashboardsController.respond(res, () => rotateShareToken(req.user?.team_id as string, req.params.id, viewerFromRequestUser(req.user)), {
      message: "Share link renewed",
    });
  }

  /** DELETE /reporting/dashboards/:id */
  @HandleExceptions()
  public static async remove(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return DashboardsController.respond(res, async () => {
      await deleteDashboard(req.user?.team_id as string, req.params.id, req.user?.id as string);
      return null;
    }, { message: "Dashboard deleted" });
  }
}
