import express from "express";
import ProjectRateCardController from "../../controllers/project-ratecard-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectManagerValidator from "../../middlewares/validators/project-manager-validator";

const projectRatecardApiRouter = express.Router();

projectRatecardApiRouter.post("/", projectManagerValidator, safeControllerFunction(ProjectRateCardController.createMany));
projectRatecardApiRouter.post("/create-project-rate-card-role",projectManagerValidator,safeControllerFunction(ProjectRateCardController.createOne));
projectRatecardApiRouter.get("/project/:project_id",safeControllerFunction(ProjectRateCardController.getByProjectId));
projectRatecardApiRouter.get("/:id",idParamValidator,safeControllerFunction(ProjectRateCardController.getById));
projectRatecardApiRouter.put("/:id",idParamValidator,safeControllerFunction(ProjectRateCardController.updateById));
projectRatecardApiRouter.put("/project/:project_id",safeControllerFunction(ProjectRateCardController.updateByProjectId));
projectRatecardApiRouter.put("/project/:project_id/members/:id/rate-card-role",idParamValidator,projectManagerValidator,safeControllerFunction(  ProjectRateCardController.updateProjectMemberByProjectIdAndMemberId));
projectRatecardApiRouter.delete("/:id",idParamValidator,safeControllerFunction(ProjectRateCardController.deleteById));
projectRatecardApiRouter.delete("/project/:project_id",safeControllerFunction(ProjectRateCardController.deleteByProjectId));

export default projectRatecardApiRouter;