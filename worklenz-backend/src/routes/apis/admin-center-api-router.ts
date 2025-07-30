import express from "express";

import AdminCenterController from "../../controllers/admin-center-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import organizationSettingsValidator from "../../middlewares/validators/organization-settings-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";

const adminCenterApiRouter = express.Router();

// overview
adminCenterApiRouter.get("/settings", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getAdminCenterSettings));
adminCenterApiRouter.get("/organization", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationDetails));
adminCenterApiRouter.get("/organization/admins", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationAdmins));
adminCenterApiRouter.put("/organization", teamOwnerOrAdminValidator, organizationSettingsValidator, safeControllerFunction(AdminCenterController.updateOrganizationName));
adminCenterApiRouter.put("/organization/calculation-method", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.updateOrganizationCalculationMethod));
adminCenterApiRouter.put("/organization/owner/contact-number", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.updateOwnerContactNumber));

// holiday settings
adminCenterApiRouter.get("/organization/holiday-settings", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationHolidaySettings));
adminCenterApiRouter.put("/organization/holiday-settings", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.updateOrganizationHolidaySettings));
adminCenterApiRouter.get("/countries-with-states", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getCountriesWithStates));

// users
adminCenterApiRouter.get("/organization/users", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationUsers));

adminCenterApiRouter.get("/organization/teams", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationTeams));
adminCenterApiRouter.get("/organization/projects", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationProjects));
adminCenterApiRouter.put("/organization/team/:id", teamOwnerOrAdminValidator, organizationSettingsValidator, safeControllerFunction(AdminCenterController.updateTeam));
adminCenterApiRouter.get("/organization/team/:id", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getTeamDetails));
adminCenterApiRouter.delete("/organization/team/:id", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.deleteTeam));
adminCenterApiRouter.put("/organization/team-member/:id", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.deleteById));

adminCenterApiRouter.post("/", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.create));
adminCenterApiRouter.put("/", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.create));

adminCenterApiRouter.get("/", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationTeams));

// billing
adminCenterApiRouter.get("/billing/info", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getBillingInfo));
adminCenterApiRouter.get("/billing/account-storage", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getAccountStorage));
adminCenterApiRouter.get("/billing/storage", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getBillingStorageInfo));
adminCenterApiRouter.get("/billing/transactions", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getBillingTransactions));
adminCenterApiRouter.get("/billing/charges", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getBillingCharges));
adminCenterApiRouter.get("/billing/modifiers", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getBillingCharges));
adminCenterApiRouter.get("/billing/countries", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getCountries));

adminCenterApiRouter.get("/billing/purchase-storage", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.purchaseStorage));

adminCenterApiRouter.get("/billing/configuration", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getBillingConfiguration));
adminCenterApiRouter.put("/billing/configuration", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.updateBillingConfiguration));

adminCenterApiRouter.get("/billing/upgrade-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.upgradePlan));
adminCenterApiRouter.get("/billing/change-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.changePlan));
adminCenterApiRouter.get("/billing/cancel-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.cancelPlan));
adminCenterApiRouter.get("/billing/pause-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.pauseSubscription));
adminCenterApiRouter.get("/billing/resume-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.resumeSubscription));

adminCenterApiRouter.get("/billing/plans", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getPlans));
adminCenterApiRouter.get("/billing/switch-to-free-plan/:id", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.switchToFreePlan));
adminCenterApiRouter.get("/billing/free-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getFreePlanLimits));

adminCenterApiRouter.post("/billing/redeem", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.redeem));

export default adminCenterApiRouter;
