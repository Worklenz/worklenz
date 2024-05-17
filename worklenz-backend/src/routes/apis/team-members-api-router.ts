import express from "express";

import TeamMembersController from "../../controllers/team-members-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import teamMembersBodyValidator from "../../middlewares/validators/team-members-body-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";

const teamMembersApiRouter = express.Router();

// export APIs
teamMembersApiRouter.get("/export-all", safeControllerFunction(TeamMembersController.exportAllMembers));
teamMembersApiRouter.get("/export/:id", idParamValidator, safeControllerFunction(TeamMembersController.exportByMember));

teamMembersApiRouter.post("/", teamOwnerOrAdminValidator, teamMembersBodyValidator, safeControllerFunction(TeamMembersController.create));
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
teamMembersApiRouter.get("/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(TeamMembersController.getById));
teamMembersApiRouter.put("/resend-invitation", teamOwnerOrAdminValidator, safeControllerFunction(TeamMembersController.resend_invitation));
teamMembersApiRouter.put("/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(TeamMembersController.update));
teamMembersApiRouter.delete("/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(TeamMembersController.deleteById));
teamMembersApiRouter.get("/deactivate/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(TeamMembersController.toggleMemberActiveStatus));

teamMembersApiRouter.put("/add-member/:id", teamOwnerOrAdminValidator, teamMembersBodyValidator, safeControllerFunction(TeamMembersController.addTeamMember));

export default teamMembersApiRouter; 
