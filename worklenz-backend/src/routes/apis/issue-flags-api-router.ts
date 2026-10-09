import express from "express";

import IssueFlagsController from "../../controllers/issue-flags-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";

const issueFlagsApiRouter = express.Router();

issueFlagsApiRouter.put(
  "/blocked/:taskId",
  requireProjectPermission("tasks", { sources: ["body.project_id"] }),
  safeControllerFunction(IssueFlagsController.setBlocked)
);

export default issueFlagsApiRouter;
