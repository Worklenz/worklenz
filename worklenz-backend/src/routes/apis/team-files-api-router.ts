import express from "express";

import TeamFilesController from "../../controllers/team-files-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

const teamFilesApiRouter = express.Router();

teamFilesApiRouter.get("/project-files", safeControllerFunction(TeamFilesController.getProjectFiles));
teamFilesApiRouter.get("/task-attachments", safeControllerFunction(TeamFilesController.getTaskAttachments));
teamFilesApiRouter.get("/links", safeControllerFunction(TeamFilesController.getLinks));

export default teamFilesApiRouter;
