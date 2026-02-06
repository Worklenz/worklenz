import express from "express";

import ProjectMembersController from "../../controllers/project-members-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import projectMemberInviteValidator from "../../middlewares/validators/project-member-invite-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectManagerValidator from "../../middlewares/validators/project-manager-validator";
import verifyProjectAccess from "../../middlewares/verify-project-access";

const projectMembersApiRouter = express.Router();

projectMembersApiRouter.post("/", projectManagerValidator, safeControllerFunction(ProjectMembersController.create));
projectMembersApiRouter.post("/invite", teamOwnerOrAdminValidator, projectMemberInviteValidator, safeControllerFunction(ProjectMembersController.createByEmail));
projectMembersApiRouter.get("/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectMembersController.get)); // id = project id
projectMembersApiRouter.delete("/:id", projectManagerValidator, safeControllerFunction(ProjectMembersController.deleteById));

// Project invitation link routes
projectMembersApiRouter.post("/invitation-link", teamOwnerOrAdminValidator, safeControllerFunction(ProjectMembersController.generateProjectInvitationLink));
projectMembersApiRouter.get("/invitation-link/status", safeControllerFunction(ProjectMembersController.getProjectInvitationLinkStatus));
projectMembersApiRouter.put("/invitation-link/revoke", teamOwnerOrAdminValidator, safeControllerFunction(ProjectMembersController.revokeProjectInvitationLink));
projectMembersApiRouter.get("/invitation-link/validate/:token", safeControllerFunction(ProjectMembersController.validateProjectInvitationLink));
projectMembersApiRouter.post("/invitation-link/accept/:token", safeControllerFunction(ProjectMembersController.acceptProjectInvitationByLink));

export default projectMembersApiRouter;
