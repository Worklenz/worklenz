import express from "express";

import TeamMembersController from "../../controllers/team-members-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import teamMembersBodyValidator from "../../middlewares/validators/team-members-body-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import teamRoleManagementValidator from "../../middlewares/validators/team-role-management-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const teamMembersApiRouter = express.Router();

// export APIs
teamMembersApiRouter.get("/export-all", safeControllerFunction(TeamMembersController.exportAllMembers));
teamMembersApiRouter.get("/export/:id", idParamValidator, safeControllerFunction(TeamMembersController.exportByMember));

teamMembersApiRouter.post("/", teamRoleManagementValidator, teamMembersBodyValidator, safeControllerFunction(TeamMembersController.create));
teamMembersApiRouter.get("/", safeControllerFunction(TeamMembersController.get));
teamMembersApiRouter.get("/list", safeControllerFunction(TeamMembersController.getTeamMemberList));
teamMembersApiRouter.get("/tree-map", safeControllerFunction(TeamMembersController.getTeamMembersTreeMap));
teamMembersApiRouter.get("/tree-map-by-member", safeControllerFunction(TeamMembersController.getTreeDataByMember));
teamMembersApiRouter.get("/tasks-by-members", safeControllerFunction(TeamMembersController.getTasksByMembers));
teamMembersApiRouter.get("/all", safeControllerFunction(TeamMembersController.getAllMembers)); // Task list assignees list
teamMembersApiRouter.get("/project/:id", safeControllerFunction(TeamMembersController.getTeamMembersByProject));
teamMembersApiRouter.get("/projects/:id", safeControllerFunction(TeamMembersController.getProjectsByTeamMember));
teamMembersApiRouter.get("/overview/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(TeamMembersController.getOverview));
teamMembersApiRouter.get("/overview-chart/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(TeamMembersController.getOverviewChart));
teamMembersApiRouter.get("/:id", teamRoleManagementValidator, idParamValidator, safeControllerFunction(TeamMembersController.getById));
teamMembersApiRouter.put("/resend-invitation", teamRoleManagementValidator, safeControllerFunction(TeamMembersController.resend_invitation));
teamMembersApiRouter.put("/:id", teamRoleManagementValidator, idParamValidator, safeControllerFunction(TeamMembersController.update));
teamMembersApiRouter.put("/:id/name", teamRoleManagementValidator, idParamValidator, safeControllerFunction(TeamMembersController.updateMemberName));
teamMembersApiRouter.delete("/:id", teamRoleManagementValidator, idParamValidator, safeControllerFunction(TeamMembersController.deleteById));
teamMembersApiRouter.get("/deactivate/:id", teamRoleManagementValidator, idParamValidator, safeControllerFunction(TeamMembersController.toggleMemberActiveStatus));

teamMembersApiRouter.put("/add-member/:id", teamOwnerOrAdminValidator, teamMembersBodyValidator, safeControllerFunction(TeamMembersController.addTeamMember));

// Team invitation link routes
teamMembersApiRouter.post("/invitation-link", teamOwnerOrAdminValidator, safeControllerFunction(TeamMembersController.generateTeamInvitationLink));
teamMembersApiRouter.get("/invitation-link/status", safeControllerFunction(TeamMembersController.getTeamInvitationLinkStatus));
teamMembersApiRouter.put("/invitation-link/revoke", teamOwnerOrAdminValidator, safeControllerFunction(TeamMembersController.revokeTeamInvitationLink));
teamMembersApiRouter.get("/invitation-link/validate/:token", safeControllerFunction(TeamMembersController.validateTeamInvitationLink));
teamMembersApiRouter.post("/invitation-link/accept/:token", safeControllerFunction(TeamMembersController.acceptTeamInvitationByLink));

export default teamMembersApiRouter; 
