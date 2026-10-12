import express from "express";
import ProjectRateCardController from "../../controllers/project-ratecard-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";
import requireFinanceFromRelatedEntity from "../../middlewares/validators/require-finance-from-related-entity";
import { requireBusinessPlan } from "../../middlewares/subscription-middleware";

const projectRatecardApiRouter = express.Router();

// Project rate cards are a Business Edition feature — gate every route server-side.
projectRatecardApiRouter.use(requireBusinessPlan);

const requireFinance = requireProjectPermission("finance", {
  sources: [
    "query.current_project_id",
    "params.project_id",
    "body.project_id",
    "query.project_id",
  ],
});

projectRatecardApiRouter.post("/", requireFinance, safeControllerFunction(ProjectRateCardController.createMany));
projectRatecardApiRouter.post(
  "/create-project-rate-card-role",
  requireFinance,
  safeControllerFunction(ProjectRateCardController.createOne)
);
projectRatecardApiRouter.get(
  "/project/:project_id",
  requireFinance,
  safeControllerFunction(ProjectRateCardController.getByProjectId)
);
projectRatecardApiRouter.get(
  "/:id",
  idParamValidator,
  requireFinanceFromRelatedEntity("rate_card_role"),
  safeControllerFunction(ProjectRateCardController.getById)
);
projectRatecardApiRouter.put(
  "/:id",
  idParamValidator,
  requireFinanceFromRelatedEntity("rate_card_role"),
  safeControllerFunction(ProjectRateCardController.updateById)
);
projectRatecardApiRouter.put(
  "/project/:project_id",
  requireFinance,
  safeControllerFunction(ProjectRateCardController.updateByProjectId)
);
projectRatecardApiRouter.put(
  "/project/:project_id/members/:id/rate-card-role",
  idParamValidator,
  requireFinance,
  safeControllerFunction(ProjectRateCardController.updateProjectMemberByProjectIdAndMemberId)
);
projectRatecardApiRouter.delete(
  "/:id",
  idParamValidator,
  requireFinanceFromRelatedEntity("rate_card_role"),
  safeControllerFunction(ProjectRateCardController.deleteById)
);
projectRatecardApiRouter.delete(
  "/project/:project_id",
  requireFinance,
  safeControllerFunction(ProjectRateCardController.deleteByProjectId)
);

export default projectRatecardApiRouter;
