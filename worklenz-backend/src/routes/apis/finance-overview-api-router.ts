import express from "express";
import FinanceOverviewController from "../../controllers/finance-overview-controller";
import FinanceReportsController from "../../ee/controllers/finance-reports-controller";
import teamLeadFinanceValidator from "../../middlewares/validators/team-lead-finance-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireFeature } from "../../shared/entitlements/gates";

const financeOverviewApiRouter = express.Router();

// Portfolio-wide finance reporting is a Business Edition feature, same tier as
// per-project finance (ee/routes/apis/project-finance-api-router.ts) — gate every route.
financeOverviewApiRouter.use(requireFeature("finance_module"));

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

financeOverviewApiRouter.get(
    "/budgets",
    teamLeadFinanceValidator,
    safeControllerFunction(FinanceReportsController.getBudgets)
);

financeOverviewApiRouter.get(
    "/invoices",
    teamLeadFinanceValidator,
    safeControllerFunction(FinanceReportsController.getInvoices)
);

financeOverviewApiRouter.get(
    "/billable-time",
    teamLeadFinanceValidator,
    safeControllerFunction(FinanceReportsController.getBillableTime)
);

financeOverviewApiRouter.get(
    "/utilization",
    teamLeadFinanceValidator,
    safeControllerFunction(FinanceReportsController.getUtilization)
);

financeOverviewApiRouter.get(
    "/profitability",
    teamLeadFinanceValidator,
    safeControllerFunction(FinanceReportsController.getProfitability)
);

financeOverviewApiRouter.get(
    "/forecasts",
    teamLeadFinanceValidator,
    safeControllerFunction(FinanceReportsController.getForecasts)
);

export default financeOverviewApiRouter;