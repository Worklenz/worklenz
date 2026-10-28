import express from "express";
import FinanceOverviewController from "../../controllers/finance-overview-controller";
import FinanceReportsController from "../../controllers/finance-reports-controller";
import { viewFinanceValidator } from "../../middlewares/validators/organization-permission-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireFeature } from "../../shared/entitlements/gates";

const financeOverviewApiRouter = express.Router();

// Portfolio-wide finance reporting is a Business Edition feature, same tier as
// per-project finance (routes/apis/project-finance-api-router.ts) — gate every route.
financeOverviewApiRouter.use(requireFeature("finance_module"));

/**
 * GET /api/finance-overview/portfolio
 * Returns one row per project with budget / cost aggregates.
 * Requires the "View finance" organization permission (all finance-overview routes are read-only).
 */
financeOverviewApiRouter.get(
    "/portfolio",
    viewFinanceValidator,
    safeControllerFunction(FinanceOverviewController.getPortfolioFinance)
);

financeOverviewApiRouter.get(
    "/export",
    viewFinanceValidator,
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
    viewFinanceValidator,
    safeControllerFunction(FinanceOverviewController.getTeamFixedCosts)
);

financeOverviewApiRouter.get(
    "/budgets",
    viewFinanceValidator,
    safeControllerFunction(FinanceReportsController.getBudgets)
);

financeOverviewApiRouter.get(
    "/invoices",
    viewFinanceValidator,
    safeControllerFunction(FinanceReportsController.getInvoices)
);

financeOverviewApiRouter.get(
    "/billable-time",
    viewFinanceValidator,
    safeControllerFunction(FinanceReportsController.getBillableTime)
);

financeOverviewApiRouter.get(
    "/utilization",
    viewFinanceValidator,
    safeControllerFunction(FinanceReportsController.getUtilization)
);

financeOverviewApiRouter.get(
    "/profitability",
    viewFinanceValidator,
    safeControllerFunction(FinanceReportsController.getProfitability)
);

financeOverviewApiRouter.get(
    "/forecasts",
    viewFinanceValidator,
    safeControllerFunction(FinanceReportsController.getForecasts)
);

export default financeOverviewApiRouter;