import express from "express";

import AdminCenterOrganizationController from "../../controllers/admin-center/admin-center-organization-controller";
import AdminCenterTeamsController from "../../controllers/admin-center/admin-center-teams-controller";
import AdminCenterBillingController from "../../controllers/admin-center/admin-center-billing-controller";
import AdminCenterHolidaysController from "../../controllers/admin-center/admin-center-holidays-controller";
import PermissionSchemesController from "../../controllers/permission-schemes-controller";
import AuditLogController from "../../controllers/audit-log-controller";
import AuditLogExportController from "../../controllers/audit-log-export-controller";
import AuditLogRetentionController from "../../controllers/audit-log-retention-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import organizationSettingsValidator from "../../middlewares/validators/organization-settings-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import {
  adminCenterAccessValidator,
  manageBillingValidator,
  manageOrganizationSettingsValidator,
  manageTeamsValidator,
  manageUsersValidator,
} from "../../middlewares/validators/organization-permission-validator";
import auditLogAccessValidator, { auditLogOwnerValidator } from "../../middlewares/validators/audit-log-access-validator";
import phoneNumberValidator from "../../middlewares/validators/phone-number-validator";
import { requireFeature } from "../../shared/entitlements/gates";

const adminCenterApiRouter = express.Router();

// overview reads — any Admin Center Manage permission; writes stay Manage organization settings
adminCenterApiRouter.get("/settings", adminCenterAccessValidator, safeControllerFunction(AdminCenterOrganizationController.getAdminCenterSettings));
adminCenterApiRouter.get("/organization", adminCenterAccessValidator, safeControllerFunction(AdminCenterOrganizationController.getOrganizationDetails));
adminCenterApiRouter.get("/organization/admins", adminCenterAccessValidator, safeControllerFunction(AdminCenterOrganizationController.getOrganizationAdmins));
adminCenterApiRouter.put("/organization", manageOrganizationSettingsValidator, organizationSettingsValidator, safeControllerFunction(AdminCenterOrganizationController.updateOrganizationName));
adminCenterApiRouter.put("/organization/calculation-method", manageOrganizationSettingsValidator, safeControllerFunction(AdminCenterOrganizationController.updateOrganizationCalculationMethod));
adminCenterApiRouter.put("/organization/owner/contact-number", manageOrganizationSettingsValidator, phoneNumberValidator, safeControllerFunction(AdminCenterOrganizationController.updateOwnerContactNumber));
adminCenterApiRouter.post("/organization/logo", manageOrganizationSettingsValidator, requireFeature("client_portal_branding"), safeControllerFunction(AdminCenterOrganizationController.uploadOrganizationLogo));
adminCenterApiRouter.delete("/organization/logo", manageOrganizationSettingsValidator, requireFeature("client_portal_branding"), safeControllerFunction(AdminCenterOrganizationController.deleteOrganizationLogo));

// holiday settings
adminCenterApiRouter.get("/organization/holiday-settings", manageOrganizationSettingsValidator, safeControllerFunction(AdminCenterHolidaysController.getOrganizationHolidaySettings));
adminCenterApiRouter.put("/organization/holiday-settings", manageOrganizationSettingsValidator, safeControllerFunction(AdminCenterHolidaysController.updateOrganizationHolidaySettings));
adminCenterApiRouter.get("/countries-with-states", manageOrganizationSettingsValidator, safeControllerFunction(AdminCenterHolidaysController.getCountriesWithStates));

// users
// Also reused as the Audit Log's actor picker (searchable, paginated,
// organization-scoped workspace users: ?search=&index=&size=). No dedicated picker endpoint
// was added since this one already fits the requirement.
adminCenterApiRouter.get("/organization/users", manageUsersValidator, safeControllerFunction(AdminCenterOrganizationController.getOrganizationUsers));

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

adminCenterApiRouter.get("/organization/teams", manageTeamsValidator, safeControllerFunction(AdminCenterTeamsController.getOrganizationTeams));
adminCenterApiRouter.get("/organization/projects", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterOrganizationController.getOrganizationProjects));
adminCenterApiRouter.put("/organization/team/:id", manageTeamsValidator, organizationSettingsValidator, safeControllerFunction(AdminCenterTeamsController.updateTeam));
adminCenterApiRouter.get("/organization/team/:id", manageTeamsValidator, safeControllerFunction(AdminCenterTeamsController.getTeamDetails));
adminCenterApiRouter.delete("/organization/team/:id", manageTeamsValidator, safeControllerFunction(AdminCenterTeamsController.deleteTeam));
adminCenterApiRouter.put("/organization/team-member/:id", manageTeamsValidator, safeControllerFunction(AdminCenterTeamsController.deleteById));

adminCenterApiRouter.get("/", manageTeamsValidator, safeControllerFunction(AdminCenterTeamsController.getOrganizationTeams));

// billing
adminCenterApiRouter.get("/billing/info", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.getBillingInfo));
adminCenterApiRouter.get("/billing/account-storage", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.getAccountStorage));
adminCenterApiRouter.get("/billing/storage", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.getBillingStorageInfo));
adminCenterApiRouter.get("/billing/transactions", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.getBillingTransactions));
adminCenterApiRouter.get("/billing/charges", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.getBillingCharges));
adminCenterApiRouter.get("/billing/modifiers", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.getBillingCharges));
adminCenterApiRouter.get("/billing/countries", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.getCountries));

adminCenterApiRouter.get("/billing/purchase-storage", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.purchaseStorage));

adminCenterApiRouter.get("/billing/configuration", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.getBillingConfiguration));
adminCenterApiRouter.put("/billing/configuration", manageBillingValidator, phoneNumberValidator, safeControllerFunction(AdminCenterBillingController.updateBillingConfiguration));

adminCenterApiRouter.get("/billing/upgrade-plan", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.upgradePlan));
adminCenterApiRouter.get("/billing/change-plan", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.changePlan));
adminCenterApiRouter.get("/billing/cancel-plan", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.cancelPlan));
adminCenterApiRouter.get("/billing/pause-plan", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.pauseSubscription));
adminCenterApiRouter.get("/billing/resume-plan", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.resumeSubscription));

adminCenterApiRouter.get("/billing/plans", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.getPlans));
adminCenterApiRouter.get("/billing/switch-to-free-plan/:id", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.switchToFreePlan));
adminCenterApiRouter.get("/billing/free-plan", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.getFreePlanLimits));

adminCenterApiRouter.post("/billing/redeem", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.redeem));

// AppSumo endpoints
adminCenterApiRouter.get("/appsumo/countdown-widget", manageBillingValidator, safeControllerFunction(AdminCenterBillingController.getAppSumoCountdownWidget));

// permission schemes — stay Owner/Admin-only
adminCenterApiRouter.get("/my-organization-permissions", safeControllerFunction(PermissionSchemesController.getMyOrganizationPermissions));
adminCenterApiRouter.get("/permission-schemes", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.getSchemes));
adminCenterApiRouter.post("/permission-schemes", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.createScheme));
adminCenterApiRouter.get("/permission-schemes/:id", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.getScheme));
adminCenterApiRouter.put("/permission-schemes/:id", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.updateScheme));
adminCenterApiRouter.delete("/permission-schemes/:id", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.deleteScheme));
adminCenterApiRouter.put("/permission-schemes/:id/grants", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.updateGrants));
adminCenterApiRouter.post("/permission-schemes/:id/permissions", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.addSchemePermissions));
adminCenterApiRouter.post("/permission-schemes/:id/permissions/remove", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.removeSchemePermissions));

// permission groups
adminCenterApiRouter.get("/permission-groups", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.getGroups));
adminCenterApiRouter.post("/permission-groups", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.createGroup));
adminCenterApiRouter.put("/permission-groups/:id", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.updateGroup));
adminCenterApiRouter.delete("/permission-groups/:id", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.deleteGroup));

// project scheme assignments
adminCenterApiRouter.get("/permission-scheme-projects", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.getTeamProjectSchemes));
adminCenterApiRouter.get("/projects/:projectId/scheme", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.getProjectScheme));
adminCenterApiRouter.put("/projects/:projectId/scheme", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.assignProjectScheme));
adminCenterApiRouter.post("/projects/:projectId/scheme/members", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.addSchemeMember));
adminCenterApiRouter.delete("/projects/:projectId/scheme/members/:memberId", teamOwnerOrAdminValidator, safeControllerFunction(PermissionSchemesController.removeSchemeMember));

export default adminCenterApiRouter;
