import express from "express";

import AdminCenterController from "../../controllers/admin-center-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import organizationSettingsValidator from "../../middlewares/validators/organization-settings-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";

const adminCenterApiRouter = express.Router();

// overview
adminCenterApiRouter.get("/organization", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationDetails));
adminCenterApiRouter.get("/organization/admins", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationAdmins));
adminCenterApiRouter.put("/organization", teamOwnerOrAdminValidator, organizationSettingsValidator, safeControllerFunction(AdminCenterController.updateOrganizationName));
adminCenterApiRouter.put("/organization/owner/contact-number", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.updateOwnerContactNumber));

// users
adminCenterApiRouter.get("/organization/users", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationUsers));

adminCenterApiRouter.get("/organization/teams", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationTeams));
adminCenterApiRouter.put("/organization/team/:id", teamOwnerOrAdminValidator, organizationSettingsValidator, safeControllerFunction(AdminCenterController.updateTeam));
adminCenterApiRouter.get("/organization/team/:id", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getTeamDetails));
adminCenterApiRouter.delete("/organization/team/:id", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.deleteTeam));
adminCenterApiRouter.put("/organization/team-member/:id", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.deleteById));

adminCenterApiRouter.post("/", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.create));
adminCenterApiRouter.put("/", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.create));

adminCenterApiRouter.get("/", teamOwnerOrAdminValidator, safeControllerFunction(AdminCenterController.getOrganizationTeams));

export default adminCenterApiRouter;
