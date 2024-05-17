import express from "express";

import ProjectFoldersController from "../../controllers/project-folders-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import schemaValidator from "../../middlewares/schema-validator";
import projectFolderSchema from "../../json_schemas/project-folder-schema";
import idParamValidator from "../../middlewares/validators/id-param-validator";

const projectFoldersApiRouter = express.Router();

projectFoldersApiRouter.post("/", schemaValidator(projectFolderSchema), safeControllerFunction(ProjectFoldersController.create));
projectFoldersApiRouter.get("/", safeControllerFunction(ProjectFoldersController.get));
projectFoldersApiRouter.get("/:id", idParamValidator, safeControllerFunction(ProjectFoldersController.getById));
projectFoldersApiRouter.put("/:id", idParamValidator, safeControllerFunction(ProjectFoldersController.update));
projectFoldersApiRouter.delete("/:id", idParamValidator, safeControllerFunction(ProjectFoldersController.deleteById));

export default projectFoldersApiRouter;
