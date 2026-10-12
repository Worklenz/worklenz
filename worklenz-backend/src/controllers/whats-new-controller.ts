import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import whatsNewService from "../services/whats-new/whats-new.service";

export default class WhatsNewController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async getCurrent(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const [release] = await Promise.all([
      whatsNewService.getCurrentReleaseForUser(req.user?.id as string),
      whatsNewService.ensureNotificationsForEligibleReleases(req.user?.id, req.user?.team_id),
    ]);
    return res.status(200).send(new ServerResponse(true, release));
  }

  @HandleExceptions()
  public static async dismiss(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    await whatsNewService.recordDismissal(req.user?.id as string, req.body?.release_id);
    return res.status(200).send(new ServerResponse(true, null));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const release = await whatsNewService.getReleaseById(req.params.id, req.user?.id as string);
    return res.status(200).send(new ServerResponse(true, release));
  }

}
