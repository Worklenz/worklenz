import express, { NextFunction } from "express";

import TaskExportController from "../../controllers/task-export-controller";
import requireTaskExportAccess from "../../middlewares/validators/task-export-access-validator";
import { requireBusinessPlan } from "../../middlewares/subscription-middleware";
import safeControllerFunction from "../../shared/safe-controller-function";
import { isValidUuid } from "../../shared/validation-helpers";
import { ServerResponse } from "../../models/server-response";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";

const taskExportApiRouter = express.Router({ mergeParams: true });

const validateJobId = (
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction
) => {
  const jobId = req.params.jobId;
  if (!jobId || !isValidUuid(jobId)) {
    return res
      .status(400)
      .send(
        new ServerResponse(false, null, "Invalid ID format. Must be a valid UUID")
      );
  }
  return next();
};

// Task export is Business-plan only, then Owner/Admin/PM/Team Lead (TE-19).
taskExportApiRouter.use(requireBusinessPlan);
taskExportApiRouter.use(requireTaskExportAccess);

taskExportApiRouter.post(
  "/",
  safeControllerFunction(TaskExportController.create)
);
taskExportApiRouter.post(
  "/filtered",
  safeControllerFunction(TaskExportController.createFiltered)
);
taskExportApiRouter.get(
  "/",
  safeControllerFunction(TaskExportController.list)
);
taskExportApiRouter.get(
  "/:jobId",
  validateJobId,
  safeControllerFunction(TaskExportController.get)
);
taskExportApiRouter.get(
  "/:jobId/download",
  validateJobId,
  safeControllerFunction(TaskExportController.download)
);

export default taskExportApiRouter;
