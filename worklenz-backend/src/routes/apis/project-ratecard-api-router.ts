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
  safeControllerFunction(ProjectRateCardController.createMany)
);
// Insert a single role for a project
projectRatecardApiRouter.post(
  "/create-project-rate-card-role",
  projectManagerValidator,
  safeControllerFunction(ProjectRateCardController.createOne)
);

// Get all roles for a project
projectRatecardApiRouter.get(
  "/project/:project_id",
  safeControllerFunction(ProjectRateCardController.getByProjectId)
);

// Get a single role by id
projectRatecardApiRouter.get(
  "/:id",
  idParamValidator,
  safeControllerFunction(ProjectRateCardController.getById)
);

// Update a single role by id
projectRatecardApiRouter.put(
  "/:id",
  idParamValidator,
  safeControllerFunction(ProjectRateCardController.updateById)
);

// Update all roles for a project (delete then insert)
projectRatecardApiRouter.put(
  "/project/:project_id",
  safeControllerFunction(ProjectRateCardController.updateByProjectId)
);

// Delete a single role by id
projectRatecardApiRouter.delete(
  "/:id",
  idParamValidator,
  safeControllerFunction(ProjectRateCardController.deleteById)
);

// Delete all roles for a project
projectRatecardApiRouter.delete(
  "/project/:project_id",
  safeControllerFunction(ProjectRateCardController.deleteByProjectId)
);

export default projectRatecardApiRouter;
