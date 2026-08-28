import express from "express";
import FinanceOverviewController from "../../controllers/finance-overview-controller";
import teamLeadFinanceValidator from "../../middlewares/validators/team-lead-finance-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireBusinessPlan } from "../../ee/middlewares/subscription-middleware";

const financeOverviewApiRouter = express.Router();

// Portfolio-wide finance reporting is a Business Edition feature, same tier as
// per-project finance (ee/routes/apis/project-finance-api-router.ts) — gate every route.
financeOverviewApiRouter.use(requireBusinessPlan);

/**
 * GET /api/finance-overview/portfolio
 * Returns one row per project with budget / cost aggregates.
 * Team leads are blocked by teamLeadFinanceValidator (same as per-project finance).
 */
financeOverviewApiRouter.get(
    "/portfolio",
    teamLeadFinanceValidator,
    safeControllerFunction(FinanceOverviewController.getPortfolioFinance)
);

financeOverviewApiRouter.get(
    "/export",
    teamLeadFinanceValidator,
    safeControllerFunction(FinanceOverviewController.exportPortfolioFinance)
);

/**
 * GET /api/finance-overview/fixed-costs
 * Returns one row per task with a fixed cost set, across every project in
 * the active team (paginated). Used by Home > Add Expenses to list fixed
 * costs already added team-wide.
 */
financeOverviewApiRouter.get(
    "/fixed-costs",
    teamLeadFinanceValidator,
    safeControllerFunction(FinanceOverviewController.getTeamFixedCosts)
);

export default financeOverviewApiRouter;