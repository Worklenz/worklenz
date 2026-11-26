import express from "express";

import ProjectLinksController from "../../controllers/project-links-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import verifyProjectAccess, { verifyNonGuestProjectAccess } from "../../middlewares/verify-project-access";

const projectLinksApiRouter = express.Router({ mergeParams: true });

projectLinksApiRouter.use(verifyProjectAccess("params", "projectId"));
projectLinksApiRouter.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  return verifyNonGuestProjectAccess("params", "projectId")(req, res, next);
});

projectLinksApiRouter.get("/", safeControllerFunction(ProjectLinksController.list));
projectLinksApiRouter.post("/", safeControllerFunction(ProjectLinksController.create));
projectLinksApiRouter.put("/:linkId", safeControllerFunction(ProjectLinksController.update));
projectLinksApiRouter.delete("/:linkId", safeControllerFunction(ProjectLinksController.remove));

export default projectLinksApiRouter;
