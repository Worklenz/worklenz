import express from "express";
import ProjectRateCardController from "../../controllers/project-ratecard-controller";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";
import requireFinanceFromRelatedEntity from "../../middlewares/validators/require-finance-from-related-entity";
import { requireFeature } from "../../shared/entitlements/gates";

const projectRatecardApiRouter = express.Router();

// Project rate cards are a Business Edition feature — gate every route server-side.
projectRatecardApiRouter.use(requireFeature("finance_module"));

const requireBodyProjectFinance = requireProjectPermission("finance", { sources: ["body.project_id"] });
const requirePathProjectFinance = requireProjectPermission("finance", { sources: ["params.project_id"] });

projectRatecardApiRouter.post("/", requireBodyProjectFinance, safeControllerFunction(ProjectRateCardController.createMany));
projectRatecardApiRouter.post(
  "/create-project-rate-card-role",
  requireBodyProjectFinance,
  safeControllerFunction(ProjectRateCardController.createOne)
);
projectRatecardApiRouter.get(
  "/project/:project_id",
  requirePathProjectFinance,
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
  requirePathProjectFinance,
  safeControllerFunction(ProjectRateCardController.updateByProjectId)
);
projectRatecardApiRouter.put(
  "/project/:project_id/members/:id/rate-card-role",
  idParamValidator,
  requirePathProjectFinance,
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
  requirePathProjectFinance,
  safeControllerFunction(ProjectRateCardController.deleteByProjectId)
);

export default projectRatecardApiRouter;
