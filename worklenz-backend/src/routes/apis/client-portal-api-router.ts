import express from "express";
import ClientPortalController from "../../controllers/client-portal-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import { authenticateClient } from "../../middlewares/client-auth-middleware";

const router = express.Router();

// Authentication routes (no authentication required)
router.get("/invitation/validate", safeControllerFunction(ClientPortalController.validateInvitation));
router.post("/invitation/accept", safeControllerFunction(ClientPortalController.acceptInvitation));
router.post("/auth/login", safeControllerFunction(ClientPortalController.clientLogin));
router.post("/auth/refresh", safeControllerFunction(ClientPortalController.refreshClientToken));
router.post("/handle-organization-invite", safeControllerFunction(ClientPortalController.handleOrganizationInvite));

// Protected routes (authentication required)
router.use(authenticateClient);

// Dashboard
router.get("/dashboard", safeControllerFunction(ClientPortalController.getDashboard));

// Services
router.get("/services", safeControllerFunction(ClientPortalController.getServices));
router.get("/services/:id", safeControllerFunction(ClientPortalController.getServiceDetails));

// Requests
router.get("/requests", safeControllerFunction(ClientPortalController.getRequests));
router.post("/requests", safeControllerFunction(ClientPortalController.createRequest));
router.get("/requests/status-options", safeControllerFunction(ClientPortalController.getRequestStatusOptions));
router.get("/requests/:id", safeControllerFunction(ClientPortalController.getRequestDetails));
router.put("/requests/:id", safeControllerFunction(ClientPortalController.updateRequest));
router.delete("/requests/:id", safeControllerFunction(ClientPortalController.deleteRequest));

// Projects
router.get("/projects", safeControllerFunction(ClientPortalController.getProjects));
router.get("/projects/:id", safeControllerFunction(ClientPortalController.getProjectDetails));

// Invoices
router.get("/invoices", safeControllerFunction(ClientPortalController.getInvoices));
router.get("/invoices/:id", safeControllerFunction(ClientPortalController.getInvoiceDetails));
router.post("/invoices/:id/pay", safeControllerFunction(ClientPortalController.payInvoice));
router.get("/invoices/:id/download", safeControllerFunction(ClientPortalController.downloadInvoice));

// Chat
router.get("/chats", safeControllerFunction(ClientPortalController.getChats));
router.get("/chats/:id", safeControllerFunction(ClientPortalController.getChatDetails));
router.post("/chats/:id/messages", safeControllerFunction(ClientPortalController.sendMessage));
router.get("/chats/:id/messages", safeControllerFunction(ClientPortalController.getMessages));

// Settings
router.get("/settings", safeControllerFunction(ClientPortalController.getSettings));
router.put("/settings", safeControllerFunction(ClientPortalController.updateSettings));
router.post("/settings/upload-logo", safeControllerFunction(ClientPortalController.uploadLogo));

// Profile
router.get("/profile", safeControllerFunction(ClientPortalController.getClientProfile));
router.put("/profile", safeControllerFunction(ClientPortalController.updateClientProfile));

// Authentication
router.post("/auth/logout", safeControllerFunction(ClientPortalController.clientLogout));

// Notifications
router.get("/notifications", safeControllerFunction(ClientPortalController.getNotifications));
router.put("/notifications/:id/read", safeControllerFunction(ClientPortalController.markNotificationRead));
router.put("/notifications/read-all", safeControllerFunction(ClientPortalController.markAllNotificationsRead));

// File uploads
router.post("/upload", safeControllerFunction(ClientPortalController.uploadFile));


export default router; 