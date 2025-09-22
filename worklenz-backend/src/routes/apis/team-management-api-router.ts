import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import TeamManagementController from "../../controllers/team-management-controller";

const teamManagementApiRouter = express.Router();

teamManagementApiRouter.post("/assign-manager", teamOwnerOrAdminValidator, safeControllerFunction(TeamManagementController.assignManager));
teamManagementApiRouter.post("/bulk-assign-members", teamOwnerOrAdminValidator, safeControllerFunction(TeamManagementController.bulkAssignMembers));
teamManagementApiRouter.post("/remove-manager-assignment", teamOwnerOrAdminValidator, safeControllerFunction(TeamManagementController.removeManagerAssignment));
teamManagementApiRouter.get("/team-hierarchy", teamOwnerOrAdminValidator, safeControllerFunction(TeamManagementController.getTeamHierarchy));

export default teamManagementApiRouter;
