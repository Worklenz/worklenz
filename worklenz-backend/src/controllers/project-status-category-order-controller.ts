import { IWorkLenzRequest } from '../interfaces/worklenz-request';
import { IWorkLenzResponse } from '../interfaces/worklenz-response';
import db from '../config/db';
import { ServerResponse } from '../models/server-response';
import WorklenzControllerBase from './worklenz-controller-base';
import HandleExceptions from '../decorators/handle-exceptions';
import { IO } from '../shared/io';
import { SocketEvents } from '../socket.io/events';
import { resolveProjectCategoryOrder, getDefaultCategoryOrder } from '../shared/status-category-order';
import { validateCategoryOrder } from '../shared/validate-category-order';

export default class ProjectStatusCategoryOrderController extends WorklenzControllerBase {

  /** T1.4 — PUT /api/v1/projects/:id/status-category-order */
  @HandleExceptions()
  public static async updateCategoryOrder(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const projectId = req.params.id;
    const { category_order } = req.body;

    // T1.3 validation
    const validation = await validateCategoryOrder(category_order);
    if (!validation.valid) {
      return res.status(400).send(new ServerResponse(false, null, validation.error));
    }

    await db.query(
      'UPDATE projects SET status_category_order = $1 WHERE id = $2',
      [JSON.stringify(category_order), projectId]
    );

    // T1.9 — emit socket event so all project members update live
    IO.emitToProjectRoom(projectId, SocketEvents.PROJECT_STATUS_CATEGORY_ORDER_CHANGED, {
      project_id: projectId,
      category_order: category_order as string[]
    });

    return res.status(200).send(new ServerResponse(true, { category_order }));
  }

  /** T1.5 — DELETE /api/v1/projects/:id/status-category-order */
  @HandleExceptions()
  public static async resetCategoryOrder(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const projectId = req.params.id;

    await db.query(
      'UPDATE projects SET status_category_order = NULL WHERE id = $1',
      [projectId]
    );

    const defaultOrder = await getDefaultCategoryOrder();

    // T1.9 — emit socket event
    IO.emitToProjectRoom(projectId, SocketEvents.PROJECT_STATUS_CATEGORY_ORDER_CHANGED, {
      project_id: projectId,
      category_order: defaultOrder
    });

    return res.status(200).send(new ServerResponse(true, { category_order: defaultOrder }));
  }
}
