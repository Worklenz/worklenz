import express from "express";

import ClientPortalV2Controller from "../../controllers/client-portal/v2/client-portal-v2-controller";
import { requireClientCapability, requireClientSubject } from "../../middlewares/client-subject-middleware";
import safeControllerFunction from "../../shared/safe-controller-function";

/**
 * Client Portal v2 client API, mounted at /api/client-portal/v2 after `authenticateClient`.
 *
 * `requireClientSubject` runs first on every route: it resolves the Active client user and their role
 * from the database on each request. Capability middleware then enforces what the role may do
 * (comment, upload, submit change requests, approve). Reads need no capability beyond being Active
 * and assigned: the gating chain is applied inside the client read services.
 */
const router = express.Router();

router.use(requireClientSubject);

const handle = (fn: unknown) => safeControllerFunction(fn as any);

// The signed-in person: profile, role, operator switches and personal preferences.
router.get("/me", handle(ClientPortalV2Controller.me));
router.put("/me", handle(ClientPortalV2Controller.updateMe));
router.get("/me/notification-prefs", handle(ClientPortalV2Controller.notificationPrefs));
router.put("/me/notification-prefs", handle(ClientPortalV2Controller.updateNotificationPrefs));
// The person's own dashboard arrangement: a display preference, so no capability is needed.
router.get("/me/dashboard-layout", handle(ClientPortalV2Controller.dashboardLayout));
router.put("/me/dashboard-layout", handle(ClientPortalV2Controller.saveDashboardLayout));
router.delete("/me/dashboard-layout", handle(ClientPortalV2Controller.resetDashboardLayout));
// Danger zone: a Client Admin soft-deletes their own login (every portal they belong to); anyone else asks
// their team to do it.
router.post("/me/account-deletion", handle(ClientPortalV2Controller.requestAccountDeletion));
router.post("/me/account-deletion-request", handle(ClientPortalV2Controller.submitAccountDeletionRequest));
router.get("/timezones", handle(ClientPortalV2Controller.timezones));

router.get("/dashboard", handle(ClientPortalV2Controller.dashboard));
router.get("/projects", handle(ClientPortalV2Controller.projects));
router.get("/projects/:projectId", handle(ClientPortalV2Controller.project));
router.get("/projects/:projectId/members", handle(ClientPortalV2Controller.projectMembers));
router.get("/projects/:projectId/mention-options", handle(ClientPortalV2Controller.mentionOptions));
router.put(
  "/projects/:projectId/members",
  requireClientCapability("manage_users"),
  handle(ClientPortalV2Controller.setProjectMembers)
);
router.get("/projects/:projectId/milestones", handle(ClientPortalV2Controller.milestones));
router.get("/projects/:projectId/tasks", handle(ClientPortalV2Controller.tasks));
router.get("/projects/:projectId/files", handle(ClientPortalV2Controller.files));
router.get("/files/:fileId/access", handle(ClientPortalV2Controller.fileAccess));
router.post("/projects/:projectId/files/presign", requireClientCapability("upload"), handle(ClientPortalV2Controller.presignUpload));
router.post("/projects/:projectId/files/confirm", requireClientCapability("upload"), handle(ClientPortalV2Controller.confirmUpload));

router.get("/approvals", handle(ClientPortalV2Controller.approvals));
router.get("/approvals/:approvalId", handle(ClientPortalV2Controller.approval));
// recordApprovalDecision checks the rule itself: a named approver who is a Client Admin, nobody else.
router.post("/approvals/:approvalId/decision", handle(ClientPortalV2Controller.decide));

router.get("/change-requests", handle(ClientPortalV2Controller.changeRequests));
router.get("/change-requests/:changeRequestId", handle(ClientPortalV2Controller.changeRequest));
router.post(
  "/change-requests/:changeRequestId/cancel",
  requireClientCapability("submit_change_request"),
  handle(ClientPortalV2Controller.cancelChangeRequest)
);
router.post("/change-requests", requireClientCapability("submit_change_request"), handle(ClientPortalV2Controller.submitChangeRequest));
router.post(
  "/change-requests/:changeRequestId/replies",
  requireClientCapability("submit_change_request"),
  handle(ClientPortalV2Controller.replyChangeRequest)
);

router.get("/threads", handle(ClientPortalV2Controller.threads));
router.post("/threads/comments", requireClientCapability("comment"), handle(ClientPortalV2Controller.comment));
router.patch("/threads/messages/:messageId", requireClientCapability("comment"), handle(ClientPortalV2Controller.editMessage));
router.delete("/threads/messages/:messageId", requireClientCapability("comment"), handle(ClientPortalV2Controller.deleteMessage));
router.post("/threads/messages/:messageId/reactions", requireClientCapability("comment"), handle(ClientPortalV2Controller.toggleReaction));
router.get("/threads/:threadId", handle(ClientPortalV2Controller.thread));
router.post("/threads/:threadId/read", handle(ClientPortalV2Controller.markThreadRead));

// Notifications are the person's own: scoped to what they can still open, with their own read state.
router.get("/notifications", handle(ClientPortalV2Controller.notifications));
router.put("/notifications/read-all", handle(ClientPortalV2Controller.markAllNotificationsRead));
router.put("/notifications/:notificationId/read", handle(ClientPortalV2Controller.markNotificationRead(true)));
router.put("/notifications/:notificationId/unread", handle(ClientPortalV2Controller.markNotificationRead(false)));

// Account > Organization. The service checks the Manage users capability and the operator's switches.
router.get("/organization/users", handle(ClientPortalV2Controller.organizationUsers));
router.post(
  "/organization/users/invite-link",
  requireClientCapability("manage_users"),
  handle(ClientPortalV2Controller.createInviteLink)
);
router.post(
  "/organization/users/:userId/invite-link",
  requireClientCapability("manage_users"),
  handle(ClientPortalV2Controller.resendOrganizationInvite)
);
router.get(
  "/organization/users/:userId/projects",
  requireClientCapability("manage_users"),
  handle(ClientPortalV2Controller.organizationUserProjects)
);
router.put(
  "/organization/users/:userId/projects",
  requireClientCapability("manage_users"),
  handle(ClientPortalV2Controller.setOrganizationUserProjects)
);
router.patch(
  "/organization/users/:userId",
  requireClientCapability("manage_users"),
  handle(ClientPortalV2Controller.updateOrganizationUser)
);
router.delete(
  "/organization/users/:userId",
  requireClientCapability("manage_users"),
  handle(ClientPortalV2Controller.removeOrganizationUser)
);

export default router;
