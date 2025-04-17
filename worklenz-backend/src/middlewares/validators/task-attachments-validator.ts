import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getFreePlanSettings, getUsedStorage } from "../../shared/paddle-utils";
import { megabytesToBytes } from "../../shared/utils";

export default async function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): Promise<IWorkLenzResponse | void> {
  const { file, file_name, project_id, size } = req.body;

  if (!file || !file_name || !project_id || !size)
    return res.status(200).send(new ServerResponse(false, null, "Upload failed"));

  if (size > 5.243e+7)
    return res.status(200).send(new ServerResponse(false, null, "Max file size for attachments is 50 MB.").withTitle("Upload failed!"));

  if (req.user?.subscription_status === "free" && req.user?.owner_id) {
    const limits = await getFreePlanSettings();

    const usedStorage = await getUsedStorage(req.user?.owner_id);
    if ((parseInt(usedStorage) + size) > megabytesToBytes(parseInt(limits.free_tier_storage))) {
      return res.status(200).send(new ServerResponse(false, [], `Sorry, the free plan cannot exceed ${limits.free_tier_storage}MB of storage.`));
    }
  }

  req.body.type = file_name.split(".").pop();

  req.body.task_id = req.body.task_id || null;

  return next();
}
