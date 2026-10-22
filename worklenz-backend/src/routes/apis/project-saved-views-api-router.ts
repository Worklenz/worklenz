import express from "express";

import ProjectSavedViewsController from "../../controllers/project-saved-views-controller";
import verifyProjectAccess, { verifyNonGuestProjectAccess } from "../../middlewares/verify-project-access";
import safeControllerFunction from "../../shared/safe-controller-function";

const projectSavedViewsApiRouter = express.Router({ mergeParams: true });

projectSavedViewsApiRouter.get(
  "/",
  verifyProjectAccess("params", "projectId"),
  safeControllerFunction(ProjectSavedViewsController.list),
);

projectSavedViewsApiRouter.post(
  "/",
  verifyProjectAccess("params", "projectId"),
  verifyNonGuestProjectAccess("params", "projectId"),
  safeControllerFunction(ProjectSavedViewsController.create),
);

projectSavedViewsApiRouter.put(
  "/:viewId",
  verifyProjectAccess("params", "projectId"),
  verifyNonGuestProjectAccess("params", "projectId"),
  safeControllerFunction(ProjectSavedViewsController.update),
);

projectSavedViewsApiRouter.delete(
  "/:viewId",
  verifyProjectAccess("params", "projectId"),
  verifyNonGuestProjectAccess("params", "projectId"),
  safeControllerFunction(ProjectSavedViewsController.remove),
);

export default projectSavedViewsApiRouter;
