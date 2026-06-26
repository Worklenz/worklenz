import express from "express";

import AdminCenterController from "../../controllers/admin-center-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import organizationSettingsValidator from "../../middlewares/validators/organization-settings-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import phoneNumberValidator from "../../middlewares/validators/phone-number-validator";

const adminCenterApiRouter = express.Router();

// overview
adminCenterApiRouter.get("/settings", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getAdminCenterSettings));
adminCenterApiRouter.get("/organization", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationDetails));
adminCenterApiRouter.get("/organization/admins", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationAdmins));
adminCenterApiRouter.put("/organization", teamOwnerOrAdminValidator, organizationSettingsValidator, safeControllerFunction(AdminCenterController.updateOrganizationName));
adminCenterApiRouter.put("/organization/calculation-method", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.updateOrganizationCalculationMethod));
adminCenterApiRouter.put("/organization/owner/contact-number", teamOwnerOrAdminValidator, phoneNumberValidator, safeControllerFunction(AdminCenterController.updateOwnerContactNumber));
// Organization logo (upload/delete) is a Business-plan feature — mounted by the EE branding router.

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

adminCenterApiRouter.get("/", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationTeams));

// Billing / subscriptions / AppSumo are Business-plan features — mounted by the EE billing router.

export default adminCenterApiRouter;
