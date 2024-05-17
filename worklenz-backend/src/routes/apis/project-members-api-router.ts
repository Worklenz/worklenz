import express from "express";

import ProjectMembersController from "../../controllers/project-members-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import projectMemberInviteValidator from "../../middlewares/validators/project-member-invite-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectManagerValidator from "../../middlewares/validators/project-manager-validator";

const projectMembersApiRouter = express.Router();

projectMembersApiRouter.post("/", projectManagerValidator, safeControllerFunction(ProjectMembersController.create));
projectMembersApiRouter.post("/invite", teamOwnerOrAdminValidator, projectMemberInviteValidator, safeControllerFunction(ProjectMembersController.createByEmail));
projectMembersApiRouter.get("/:id", idParamValidator, safeControllerFunction(ProjectMembersController.get)); // id = project id
projectMembersApiRouter.delete("/:id", projectManagerValidator, safeControllerFunction(ProjectMembersController.deleteById));

export default projectMembersApiRouter;
