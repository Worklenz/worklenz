import express from "express";
import safeControllerFunction from "../../shared/safe-controller-function";
import TeamManagementController from "../../controllers/team-management-controller";
import teamRoleManagementValidator from "../../middlewares/validators/team-role-management-validator";

const teamManagementApiRouter = express.Router();

teamManagementApiRouter.post("/assign-manager", teamRoleManagementValidator, safeControllerFunction(TeamManagementController.assignManager));
teamManagementApiRouter.post("/bulk-assign-members", teamRoleManagementValidator, safeControllerFunction(TeamManagementController.bulkAssignMembers));
teamManagementApiRouter.post("/remove-manager-assignment", teamRoleManagementValidator, safeControllerFunction(TeamManagementController.removeManagerAssignment));
teamManagementApiRouter.get("/team-hierarchy", teamRoleManagementValidator, safeControllerFunction(TeamManagementController.getTeamHierarchy));

export default teamManagementApiRouter;
