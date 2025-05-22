import express from "express";
import ProjectRateCardController from "../../controllers/project-ratecard-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectManagerValidator from "../../middlewares/validators/project-manager-validator";

const projectRatecardApiRouter = express.Router();

// Insert multiple roles for a project
projectRatecardApiRouter.post(
  "/",
  projectManagerValidator,
  safeControllerFunction(ProjectRateCardController.insertMany)
);
// Insert a single role for a project
projectRatecardApiRouter.post(
  "/create-project-rate-card-role",
  projectManagerValidator,
  safeControllerFunction(ProjectRateCardController.insertOne)
);

// Get all roles for a project
projectRatecardApiRouter.get(
  "/project/:project_id",
  safeControllerFunction(ProjectRateCardController.getFromProjectId)
);

// Get a single role by id
projectRatecardApiRouter.get(
  "/:id",
  idParamValidator,
  safeControllerFunction(ProjectRateCardController.getFromId)
);

// Update a single role by id
projectRatecardApiRouter.put(
  "/:id",
  idParamValidator,
  safeControllerFunction(ProjectRateCardController.updateFromId)
);

// Update all roles for a project (delete then insert)
projectRatecardApiRouter.put(
  "/project/:project_id",
  safeControllerFunction(ProjectRateCardController.updateFromProjectId)
);

// Delete a single role by id
projectRatecardApiRouter.delete(
  "/:id",
  idParamValidator,
  safeControllerFunction(ProjectRateCardController.deleteFromId)
);

// Delete all roles for a project
projectRatecardApiRouter.delete(
  "/project/:project_id",
  safeControllerFunction(ProjectRateCardController.deleteFromProjectId)
);

export default projectRatecardApiRouter;
