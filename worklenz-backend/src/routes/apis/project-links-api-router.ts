import express from "express";

import ProjectLinksController from "../../controllers/project-links-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const projectLinksApiRouter = express.Router({ mergeParams: true });

projectLinksApiRouter.get("/", safeControllerFunction(ProjectLinksController.list));
projectLinksApiRouter.post("/", safeControllerFunction(ProjectLinksController.create));
projectLinksApiRouter.put("/:linkId", safeControllerFunction(ProjectLinksController.update));
projectLinksApiRouter.delete("/:linkId", safeControllerFunction(ProjectLinksController.remove));

export default projectLinksApiRouter;
