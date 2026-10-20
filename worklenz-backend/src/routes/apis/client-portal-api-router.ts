import express from "express";
import ClientPortalAuthController from "../../controllers/client-portal/client-portal-auth-controller";
import ClientPortalDashboardController from "../../controllers/client-portal/client-portal-dashboard-controller";
import ClientPortalServicesController from "../../controllers/client-portal/client-portal-services-controller";
import ClientPortalRequestsController from "../../controllers/client-portal/client-portal-requests-controller";
import ClientPortalCommentsController from "../../controllers/client-portal/client-portal-comments-controller";
import ClientPortalProjectsController from "../../controllers/client-portal/client-portal-projects-controller";
import ClientPortalInvoicesController from "../../controllers/client-portal/client-portal-invoices-controller";
import ClientPortalChatController from "../../controllers/client-portal/client-portal-chat-controller";
import ClientPortalSettingsController from "../../controllers/client-portal/client-portal-settings-controller";
import ClientPortalProfileController from "../../controllers/client-portal/client-portal-profile-controller";
import ClientPortalAttachmentController from "../../controllers/client-portal-attachment-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import { authenticateClient, requireClientPermission } from "../../middlewares/client-auth-middleware";
import { requireFeatureForOrganization } from "../../shared/entitlements/gates";
import { requireClientCapability, requireClientSubject } from "../../middlewares/client-subject-middleware";
import { requireInvoicesVisible } from "../../middlewares/client-invoices-visible-middleware";
import { ServerResponse } from "../../models/server-response";
import ClientSignInController from "../../controllers/client-portal/v2/client-sign-in-controller";
import clientPortalV2ClientRouter from "./client-portal-v2-client-router";
import phoneNumberValidator from "../../middlewares/validators/phone-number-validator";
import {
  clientSignInRequestLimiter,
  clientSignInVerifyLimiter,
  clientTokenLimiter,
} from "../../middlewares/client-sign-in-rate-limiter";

const router = express.Router();

/**
 * Services, Requests and Chats were retired in Client Portal v2. Their data is kept, but nothing new
 * may be written, or a client would be talking into a place the team no longer reads. Reads stay so
 * existing history can still be opened until the data is exported and dropped.
 */
const movedInV2: express.RequestHandler = (_req, res) =>
  res
    .status(410)
    .json(
      new ServerResponse(
        false,
        { code: "MOVED_IN_V2" },
        "This feature has moved. Your project team now shares updates, approvals and changes through your projects."
      )
    );

/** Team actions that used to be mounted on the client router. A client token is never allowed to use them. */
const staffOnly: express.RequestHandler = (_req, res) =>
  res.status(403).json(new ServerResponse(false, { code: "STAFF_ONLY" }, "Only your project team can do this."));

/**
 * Client users no longer have passwords. The old password routes answer 410 so a stale client app gets
 * a clear message instead of a login that can never succeed.
 */
const signInChanged: express.RequestHandler = (_req, res) =>
  res
    .status(410)
    .json(
      new ServerResponse(
        false,
        { code: "SIGN_IN_CHANGED" },
        "Sign-in now uses a one-time code sent to your email address. Open the sign-in page and enter your email."
      )
    );

// Authentication routes (no authentication required)
router.get("/invitation/validate", safeControllerFunction(ClientPortalAuthController.validateInvitation));
router.get("/invitation/validate/:slug", safeControllerFunction(ClientPortalAuthController.validateInvitationBySlug));
router.post("/auth/otp/request", clientSignInRequestLimiter, ClientSignInController.requestCode);
router.post("/auth/otp/verify", clientSignInVerifyLimiter, ClientSignInController.verifyCode);
router.post("/auth/refresh", clientTokenLimiter, safeControllerFunction(ClientPortalAuthController.refreshClientToken));
router.post("/invitation/accept", signInChanged);
router.post("/auth/login", signInChanged);
router.post("/auth/forgot-password", signInChanged);
router.post("/auth/reset-password", signInChanged);
router.post("/handle-organization-invite", clientTokenLimiter, safeControllerFunction(ClientPortalAuthController.handleOrganizationInvite));

// Protected routes (authentication required)
router.use(authenticateClient);

// Logout and organization switching must stay reachable even when the client's
// *currently selected* organization lacks a Business plan — otherwise a client
// who belongs to multiple organizations could get locked out of switching to
// one that does have a plan, and couldn't even log out cleanly.
router.post("/auth/logout", safeControllerFunction(ClientPortalAuthController.clientLogout));
router.get("/organizations", safeControllerFunction(ClientPortalAuthController.getClientOrganizations));
router.post("/organizations/switch", safeControllerFunction(ClientPortalAuthController.switchOrganization));

// An invitation link opened while already signed in: joins the portal with no code (same address required).
router.post("/organizations/accept-invite", ClientSignInController.acceptInvite);

// Client Portal authorization
router.use(requireFeatureForOrganization("client_portal"));

// Client Portal v2: project-centred, item-level sharing. Runs its own per-request subject check
// (Active user, fresh role) and applies the gating chain in the read/write services.
router.use("/v2", clientPortalV2ClientRouter);

// Everything below is the older (v1) surface that is still readable. It runs the same per-request subject
// check as v2: the user must still be Active with a fresh role, so a removed or deactivated contact is
// refused on their next request instead of keeping access until the token expires. Routes that must work
// without an Active login (organizations, switch, accept-invite, logout, refresh) are deliberately left out.
router.use(
  [
    "/dashboard",
    "/services",
    "/requests",
    "/projects",
    "/tasks",
    "/invoices",
    "/chats",
    "/organization-settings",
    "/profile",
    "/notifications",
    "/upload",
    "/attachments",
  ],
  requireClientSubject
);

// Dashboard
router.get("/dashboard", safeControllerFunction(ClientPortalDashboardController.getDashboard));

// Services (client-facing)
router.get("/services", safeControllerFunction(ClientPortalServicesController.getServices));
router.get("/services/:id", safeControllerFunction(ClientPortalServicesController.getServiceDetails));

// Requests
router.get("/requests", safeControllerFunction(ClientPortalRequestsController.getRequests));
router.post("/requests", movedInV2);
router.get("/requests/status-options", safeControllerFunction(ClientPortalRequestsController.getRequestStatusOptions));
// Comment routes must come before /:id route to avoid route matching conflicts
router.get("/requests/:id/comments", safeControllerFunction(ClientPortalCommentsController.getRequestComments));
router.post("/requests/:id/comments", movedInV2);
router.get("/requests/:id/history", safeControllerFunction(ClientPortalRequestsController.getRequestStatusHistory));
router.get("/requests/:id", safeControllerFunction(ClientPortalRequestsController.getRequestDetails));
router.put("/requests/:id", movedInV2);
router.delete("/requests/:id", movedInV2);

// Projects
router.get("/projects", safeControllerFunction(ClientPortalProjectsController.getProjects));
router.get("/projects/statuses", safeControllerFunction(ClientPortalProjectsController.getProjectStatuses));
router.get("/projects/time-logs", safeControllerFunction(ClientPortalProjectsController.getProjectTimeLogs));
router.get("/projects/:id", safeControllerFunction(ClientPortalProjectsController.getProjectDetails));
router.get("/projects/:id/tasks", safeControllerFunction(ClientPortalProjectsController.getProjectTasks));

// Tasks
router.get("/tasks/:id/comments", safeControllerFunction(ClientPortalProjectsController.getTaskComments));
// Task comments are v2 discussion threads now; the old comment list stays readable for history only.
router.post("/tasks/:id/comments", movedInV2);
router.post("/tasks/:id/mark-viewed", safeControllerFunction(ClientPortalProjectsController.markTaskCommentsAsViewed));
router.get("/tasks/:id", safeControllerFunction(ClientPortalProjectsController.getTaskDetails));

// Invoices: only when the operator turned them on for this portal. Creating, editing, deleting, sending and
// marking invoices paid are the team's actions (they have their own routes); a client can read, download
// and, as a Client Admin, send payment details for the team to confirm (it does not mark the invoice paid).
router.use("/invoices", requireInvoicesVisible);
router.get("/invoices", safeControllerFunction(ClientPortalInvoicesController.getInvoices));
router.post("/invoices", staffOnly);
router.get("/invoices/:id", safeControllerFunction(ClientPortalInvoicesController.getInvoiceDetails));
router.put("/invoices/:id", staffOnly);
router.delete("/invoices/:id", staffOnly);
router.post("/invoices/:id/pay", requireClientCapability("approve"), safeControllerFunction(ClientPortalInvoicesController.payInvoice));
router.post("/invoices/:id/send", staffOnly);
router.post("/invoices/:id/mark-paid", staffOnly);
router.get("/invoices/:id/download", safeControllerFunction(ClientPortalInvoicesController.downloadInvoice));

// Chat
router.get("/chats", safeControllerFunction(ClientPortalChatController.getChats));
router.post("/chats", movedInV2);
router.get("/chats/:id", safeControllerFunction(ClientPortalChatController.getChatDetails));
router.post("/chats/:id/messages", movedInV2);
router.get("/chats/:id/messages", safeControllerFunction(ClientPortalChatController.getMessages));

// Organization Settings (for client users - uses organizationId from token)
router.get("/organization-settings", safeControllerFunction(ClientPortalSettingsController.getOrganizationSettings));

// Profile
router.get("/profile", safeControllerFunction(ClientPortalProfileController.getClientProfile));
router.put("/profile", safeControllerFunction(ClientPortalProfileController.updateClientProfile));


// Notifications
// The v1 list returned every notification of the organization to every client user. v2 scopes them to the
// person's projects and addressees and keeps read state per person (`/v2/notifications`).
router.get("/notifications", movedInV2);
router.put("/notifications/read-all", movedInV2);
router.put("/notifications/:id/read", movedInV2);

// File uploads and attachments (using new attachment controller with S3 storage)
router.post("/upload", requireClientCapability("upload"), safeControllerFunction(ClientPortalAttachmentController.uploadFile));
router.get("/attachments/unlinked", safeControllerFunction(ClientPortalAttachmentController.getUnlinkedAttachments));
router.get("/attachments/:attachmentId", safeControllerFunction(ClientPortalAttachmentController.getAttachment));
router.delete("/attachments/:attachmentId", requireClientCapability("upload"), safeControllerFunction(ClientPortalAttachmentController.deleteAttachment));
router.get("/requests/:requestId/attachments", safeControllerFunction(ClientPortalAttachmentController.getRequestAttachments));
router.post("/requests/:requestId/attachments/link", movedInV2);

export default router;