import express from "express";

import ProjectMembersController from "../../controllers/project-members-controller";

import idParamValidator from "../../middlewares/validators/id-param-validator";
import projectMemberInviteValidator from "../../middlewares/validators/project-member-invite-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import { requireProjectPermission } from "../../middlewares/validators/require-project-permission";
import verifyProjectAccess from "../../middlewares/verify-project-access";

const projectMembersApiRouter = express.Router();

projectMembersApiRouter.post(
  "/",
  requireProjectPermission("members.add", {
    sources: ["query.current_project_id", "body.project_id"],
  }),
  safeControllerFunction(ProjectMembersController.create)
);

// Email invite (including guests): same members.add gate — PMs on the project included.
projectMembersApiRouter.post(
  "/invite",
  requireProjectPermission("members.add", {
    sources: ["body.project_id", "query.current_project_id"],
  }),
  projectMemberInviteValidator,
  safeControllerFunction(ProjectMembersController.createByEmail)
);

// Project invitation link routes
projectMembersApiRouter.post(
  "/invitation-link",
  requireProjectPermission("members.add", {
    sources: ["body.project_id", "query.current_project_id"],
  }),
  safeControllerFunction(ProjectMembersController.generateProjectInvitationLink)
);
projectMembersApiRouter.get("/invitation-link/status", safeControllerFunction(ProjectMembersController.getProjectInvitationLinkStatus));
projectMembersApiRouter.put("/invitation-link/revoke", teamOwnerOrAdminValidator, safeControllerFunction(ProjectMembersController.revokeProjectInvitationLink));
projectMembersApiRouter.get("/invitation-link/validate/:token", safeControllerFunction(ProjectMembersController.validateProjectInvitationLink));
projectMembersApiRouter.post("/invitation-link/accept/:token", safeControllerFunction(ProjectMembersController.acceptProjectInvitationByLink));

// Guest members management routes (team-wide guest admin — Owner/Admin only)
projectMembersApiRouter.get("/guests", teamOwnerOrAdminValidator, safeControllerFunction(ProjectMembersController.getGuestMembers));
projectMembersApiRouter.patch("/guests/deactivate/:id", teamOwnerOrAdminValidator, safeControllerFunction(ProjectMembersController.toggleGuestStatus));
projectMembersApiRouter.delete("/guests/:id", teamOwnerOrAdminValidator, safeControllerFunction(ProjectMembersController.deleteGuest));

projectMembersApiRouter.get("/:id", idParamValidator, verifyProjectAccess('params', 'id'), safeControllerFunction(ProjectMembersController.get)); // id = project id
projectMembersApiRouter.delete(
  "/:id",
  requireProjectPermission("members.removeMember", {
    sources: ["query.current_project_id", "body.project_id"],
  }),
  safeControllerFunction(ProjectMembersController.deleteById)
);

export default projectMembersApiRouter;
