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
import ClientPortalNotificationsController from "../../controllers/client-portal/client-portal-notifications-controller";
import ClientPortalAttachmentController from "../../controllers/client-portal-attachment-controller";
import safeControllerFunction from "../../../shared/safe-controller-function";
import { authenticateClient, requireClientPermission } from "../../../middlewares/client-auth-middleware";
import { requireBusinessPlanForOrganization } from "../../middlewares/subscription-middleware";
import phoneNumberValidator from "../../../middlewares/validators/phone-number-validator";
import { resetPasswordLimiter, updatePasswordLimiter } from "../../../middlewares/reset-password-rate-limiter";

const router = express.Router();

// Authentication routes (no authentication required)
router.get("/invitation/validate", safeControllerFunction(ClientPortalAuthController.validateInvitation));
router.get("/invitation/validate/:slug", safeControllerFunction(ClientPortalAuthController.validateInvitationBySlug));
router.post("/invitation/accept", safeControllerFunction(ClientPortalAuthController.acceptInvitation));
router.post("/auth/login", safeControllerFunction(ClientPortalAuthController.clientLogin));
router.post("/auth/refresh", safeControllerFunction(ClientPortalAuthController.refreshClientToken));
router.post("/auth/forgot-password", resetPasswordLimiter, safeControllerFunction(ClientPortalAuthController.forgotPassword));
router.post("/auth/reset-password", updatePasswordLimiter, safeControllerFunction(ClientPortalAuthController.resetPassword));
router.post("/handle-organization-invite", safeControllerFunction(ClientPortalAuthController.handleOrganizationInvite));

// Protected routes (authentication required)
router.use(authenticateClient);

// Logout and organization switching must stay reachable even when the client's
// *currently selected* organization lacks a Business plan — otherwise a client
// who belongs to multiple organizations could get locked out of switching to
// one that does have a plan, and couldn't even log out cleanly.
router.post("/auth/logout", safeControllerFunction(ClientPortalAuthController.clientLogout));
router.get("/organizations", safeControllerFunction(ClientPortalAuthController.getClientOrganizations));
router.post("/organizations/switch", safeControllerFunction(ClientPortalAuthController.switchOrganization));

// Client Portal is a Business Edition feature — every route past this point requires
// the client's organization to hold a Business plan, matching worklenz-client-portal/LICENSE.md.
router.use(requireBusinessPlanForOrganization);

// Dashboard
router.get("/dashboard", safeControllerFunction(ClientPortalDashboardController.getDashboard));

// Services (client-facing)
router.get("/services", safeControllerFunction(ClientPortalServicesController.getServices));
router.get("/services/:id", safeControllerFunction(ClientPortalServicesController.getServiceDetails));

// Services (organization management)
router.get("/services/organization/all", safeControllerFunction(ClientPortalServicesController.getOrganizationServices));
router.post("/services/organization", safeControllerFunction(ClientPortalServicesController.createOrganizationService));
router.get("/services/organization/:id", safeControllerFunction(ClientPortalServicesController.getOrganizationServiceById));
router.put("/services/organization/:id", safeControllerFunction(ClientPortalServicesController.updateOrganizationService));
router.delete("/services/organization/:id", safeControllerFunction(ClientPortalServicesController.deleteOrganizationService));

// Requests
router.get("/requests", safeControllerFunction(ClientPortalRequestsController.getRequests));
router.post("/requests", safeControllerFunction(ClientPortalRequestsController.createRequest));
router.get("/requests/status-options", safeControllerFunction(ClientPortalRequestsController.getRequestStatusOptions));
// Comment routes must come before /:id route to avoid route matching conflicts
router.get("/requests/:id/comments", safeControllerFunction(ClientPortalCommentsController.getRequestComments));
router.post("/requests/:id/comments", safeControllerFunction(ClientPortalCommentsController.addRequestComment));
router.get("/requests/:id/history", safeControllerFunction(ClientPortalRequestsController.getRequestStatusHistory));
router.get("/requests/:id", safeControllerFunction(ClientPortalRequestsController.getRequestDetails));
router.put("/requests/:id", safeControllerFunction(ClientPortalRequestsController.updateRequest));
router.delete("/requests/:id", safeControllerFunction(ClientPortalRequestsController.deleteRequest));

// Projects
router.get("/projects", safeControllerFunction(ClientPortalProjectsController.getProjects));
router.get("/projects/statuses", safeControllerFunction(ClientPortalProjectsController.getProjectStatuses));
router.get("/projects/time-logs", safeControllerFunction(ClientPortalProjectsController.getProjectTimeLogs));
router.get("/projects/:id", safeControllerFunction(ClientPortalProjectsController.getProjectDetails));
router.get("/projects/:id/tasks", safeControllerFunction(ClientPortalProjectsController.getProjectTasks));

// Tasks
router.get("/tasks/:id/comments", safeControllerFunction(ClientPortalProjectsController.getTaskComments));
router.post("/tasks/:id/comments", safeControllerFunction(ClientPortalProjectsController.addTaskComment));
router.post("/tasks/:id/mark-viewed", safeControllerFunction(ClientPortalProjectsController.markTaskCommentsAsViewed));
router.get("/tasks/:id", safeControllerFunction(ClientPortalProjectsController.getTaskDetails));

// Invoices
router.get("/invoices", safeControllerFunction(ClientPortalInvoicesController.getInvoices));
router.post("/invoices", safeControllerFunction(ClientPortalInvoicesController.createInvoice));
router.get("/invoices/:id", safeControllerFunction(ClientPortalInvoicesController.getInvoiceDetails));
router.put("/invoices/:id", safeControllerFunction(ClientPortalInvoicesController.updateInvoice));
router.delete("/invoices/:id", safeControllerFunction(ClientPortalInvoicesController.deleteInvoice));
router.post("/invoices/:id/pay", safeControllerFunction(ClientPortalInvoicesController.payInvoice));
router.post("/invoices/:id/send", safeControllerFunction(ClientPortalInvoicesController.sendInvoice));
router.post("/invoices/:id/mark-paid", safeControllerFunction(ClientPortalInvoicesController.markInvoiceAsPaid));
router.get("/invoices/:id/download", safeControllerFunction(ClientPortalInvoicesController.downloadInvoice));

// Chat
router.get("/chats", safeControllerFunction(ClientPortalChatController.getChats));
router.post("/chats", safeControllerFunction(ClientPortalChatController.createChat));
router.get("/chats/:id", safeControllerFunction(ClientPortalChatController.getChatDetails));
router.post("/chats/:id/messages", safeControllerFunction(ClientPortalChatController.sendMessage));
router.get("/chats/:id/messages", safeControllerFunction(ClientPortalChatController.getMessages));

// Settings (for organization management - requires team_id)
router.get("/settings", safeControllerFunction(ClientPortalSettingsController.getSettings));
router.put("/settings", phoneNumberValidator, safeControllerFunction(ClientPortalSettingsController.updateSettings));
router.post("/settings/upload-logo", safeControllerFunction(ClientPortalSettingsController.uploadLogo));

// Organization Settings (for client users - uses organizationId from token)
router.get("/organization-settings", safeControllerFunction(ClientPortalSettingsController.getOrganizationSettings));

// Profile
router.get("/profile", safeControllerFunction(ClientPortalProfileController.getClientProfile));
router.put("/profile", safeControllerFunction(ClientPortalProfileController.updateClientProfile));

// Notifications
router.get("/notifications", safeControllerFunction(ClientPortalNotificationsController.getNotifications));
router.put("/notifications/:id/read", safeControllerFunction(ClientPortalNotificationsController.markNotificationRead));
router.put("/notifications/read-all", safeControllerFunction(ClientPortalNotificationsController.markAllNotificationsRead));

// File uploads and attachments (using new attachment controller with S3 storage)
router.post("/upload", safeControllerFunction(ClientPortalAttachmentController.uploadFile));
router.get("/attachments/unlinked", safeControllerFunction(ClientPortalAttachmentController.getUnlinkedAttachments));
router.get("/attachments/:attachmentId", safeControllerFunction(ClientPortalAttachmentController.getAttachment));
router.delete("/attachments/:attachmentId", safeControllerFunction(ClientPortalAttachmentController.deleteAttachment));
router.get("/requests/:requestId/attachments", safeControllerFunction(ClientPortalAttachmentController.getRequestAttachments));
router.post("/requests/:requestId/attachments/link", safeControllerFunction(ClientPortalAttachmentController.linkAttachmentsToRequest));

export default router;