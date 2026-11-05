import express from "express";

import AdminCenterOrganizationController from "../../controllers/admin-center/admin-center-organization-controller";
import AdminCenterTeamsController from "../../controllers/admin-center/admin-center-teams-controller";
import AdminCenterBillingController from "../../controllers/admin-center/admin-center-billing-controller";
import AdminCenterHolidaysController from "../../controllers/admin-center/admin-center-holidays-controller";
import AuditLogController from "../../controllers/audit-log-controller";
import AuditLogExportController from "../../controllers/audit-log-export-controller";
import AuditLogRetentionController from "../../controllers/audit-log-retention-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import organizationSettingsValidator from "../../middlewares/validators/organization-settings-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import auditLogAccessValidator, { auditLogOwnerValidator } from "../../middlewares/validators/audit-log-access-validator";
import phoneNumberValidator from "../../middlewares/validators/phone-number-validator";
import { requireFeature } from "../../shared/entitlements/gates";

const adminCenterApiRouter = express.Router();

// overview
adminCenterApiRouter.get("/settings", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterOrganizationController.getAdminCenterSettings));
adminCenterApiRouter.get("/organization", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterOrganizationController.getOrganizationDetails));
adminCenterApiRouter.get("/organization/admins", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterOrganizationController.getOrganizationAdmins));
adminCenterApiRouter.put("/organization", teamOwnerOrAdminValidator, organizationSettingsValidator, safeControllerFunction(AdminCenterOrganizationController.updateOrganizationName));
adminCenterApiRouter.put("/organization/calculation-method", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterOrganizationController.updateOrganizationCalculationMethod));
adminCenterApiRouter.put("/organization/owner/contact-number", teamOwnerOrAdminValidator, phoneNumberValidator, safeControllerFunction(AdminCenterOrganizationController.updateOwnerContactNumber));
adminCenterApiRouter.post("/organization/logo", teamOwnerOrAdminValidator, requireFeature("client_portal_branding"), safeControllerFunction(AdminCenterOrganizationController.uploadOrganizationLogo));
adminCenterApiRouter.delete("/organization/logo", teamOwnerOrAdminValidator, requireFeature("client_portal_branding"), safeControllerFunction(AdminCenterOrganizationController.deleteOrganizationLogo));

// holiday settings
adminCenterApiRouter.get("/organization/holiday-settings", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterHolidaysController.getOrganizationHolidaySettings));
adminCenterApiRouter.put("/organization/holiday-settings", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterHolidaysController.updateOrganizationHolidaySettings));
adminCenterApiRouter.get("/countries-with-states", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterHolidaysController.getCountriesWithStates));

// users
// Also reused as the Audit Log's actor picker (searchable, paginated,
// organization-scoped workspace users: ?search=&index=&size=). No dedicated picker endpoint
// was added since this one already fits the requirement.
adminCenterApiRouter.get("/organization/users", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterOrganizationController.getOrganizationUsers));

// audit log — note the dedicated 403 access guard instead of
// teamOwnerOrAdminValidator's 401, per that task's explicit requirement.
adminCenterApiRouter.get("/organization/audit-log", auditLogAccessValidator, safeControllerFunction(AuditLogController.getAuditEvents));
adminCenterApiRouter.get("/organization/audit-log/summary", auditLogAccessValidator, safeControllerFunction(AuditLogController.getSummary));

// audit log CSV export — same access guard as the read endpoint above;
// exporting is a superset of viewing, not a separate permission tier.
adminCenterApiRouter.post("/organization/audit-log/export", auditLogAccessValidator, safeControllerFunction(AuditLogExportController.create));
adminCenterApiRouter.get("/organization/audit-log/export/latest", auditLogAccessValidator, safeControllerFunction(AuditLogExportController.latest));
adminCenterApiRouter.get("/organization/audit-log/export/:jobId", auditLogAccessValidator, safeControllerFunction(AuditLogExportController.get));
adminCenterApiRouter.get("/organization/audit-log/export/:jobId/download", auditLogAccessValidator, safeControllerFunction(AuditLogExportController.download));

// audit log retention — viewable by Owner/Admin, changeable by Owner only.
adminCenterApiRouter.get("/organization/audit-log/retention", auditLogAccessValidator, safeControllerFunction(AuditLogRetentionController.get));
adminCenterApiRouter.put("/organization/audit-log/retention", auditLogOwnerValidator, safeControllerFunction(AuditLogRetentionController.update));

adminCenterApiRouter.get("/organization/teams", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterTeamsController.getOrganizationTeams));
adminCenterApiRouter.get("/organization/projects", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterOrganizationController.getOrganizationProjects));
adminCenterApiRouter.put("/organization/team/:id", teamOwnerOrAdminValidator, organizationSettingsValidator, safeControllerFunction(AdminCenterTeamsController.updateTeam));
adminCenterApiRouter.get("/organization/team/:id", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterTeamsController.getTeamDetails));
adminCenterApiRouter.delete("/organization/team/:id", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterTeamsController.deleteTeam));
adminCenterApiRouter.put("/organization/team-member/:id", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterTeamsController.deleteById));

adminCenterApiRouter.get("/", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterTeamsController.getOrganizationTeams));

// billing
adminCenterApiRouter.get("/billing/info", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.getBillingInfo));
adminCenterApiRouter.get("/billing/account-storage", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.getAccountStorage));
adminCenterApiRouter.get("/billing/storage", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.getBillingStorageInfo));
adminCenterApiRouter.get("/billing/transactions", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.getBillingTransactions));
adminCenterApiRouter.get("/billing/charges", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.getBillingCharges));
adminCenterApiRouter.get("/billing/modifiers", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.getBillingCharges));
adminCenterApiRouter.get("/billing/countries", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.getCountries));

adminCenterApiRouter.get("/billing/purchase-storage", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.purchaseStorage));

adminCenterApiRouter.get("/billing/configuration", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.getBillingConfiguration));
adminCenterApiRouter.put("/billing/configuration", teamOwnerOrAdminValidator, phoneNumberValidator, safeControllerFunction(AdminCenterBillingController.updateBillingConfiguration));

adminCenterApiRouter.get("/billing/upgrade-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.upgradePlan));
adminCenterApiRouter.get("/billing/change-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.changePlan));
adminCenterApiRouter.get("/billing/cancel-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.cancelPlan));
adminCenterApiRouter.get("/billing/pause-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.pauseSubscription));
adminCenterApiRouter.get("/billing/resume-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.resumeSubscription));

adminCenterApiRouter.get("/billing/plans", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.getPlans));
adminCenterApiRouter.get("/billing/switch-to-free-plan/:id", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.switchToFreePlan));
adminCenterApiRouter.get("/billing/free-plan", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.getFreePlanLimits));

adminCenterApiRouter.post("/billing/redeem", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.redeem));

// AppSumo endpoints
adminCenterApiRouter.get("/appsumo/countdown-widget", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterBillingController.getAppSumoCountdownWidget));

export default adminCenterApiRouter;
