import express from "express";

import ClientsController from "../../controllers/clients-controller";
import ClientPortalInvoicesController from "../../ee/controllers/client-portal/client-portal-invoices-controller";

import clientsBodyValidator from "../../middlewares/validators/clients-body-validator";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectManagerValidator from "../../middlewares/validators/project-manager-validator";
import chatIdParamValidator from "../../middlewares/validators/chat-id-param-validator";
import phoneNumberValidator from "../../middlewares/validators/phone-number-validator";
import { requireBusinessPlan } from "../../ee/middlewares/subscription-middleware";

const clientsApiRouter = express.Router();

clientsApiRouter.post("/", projectManagerValidator, clientsBodyValidator, safeControllerFunction(ClientsController.create));
clientsApiRouter.get("/", safeControllerFunction(ClientsController.get));
// Lightweight lookup for filter dropdowns — must be declared before /:id so Express
// does not treat the literal string "lookup" as an id parameter value.
clientsApiRouter.get("/lookup", safeControllerFunction(ClientsController.getLookup));
clientsApiRouter.get("/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(ClientsController.getById));
clientsApiRouter.put("/:id", teamOwnerOrAdminValidator, clientsBodyValidator, idParamValidator, safeControllerFunction(ClientsController.update));
clientsApiRouter.delete("/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(ClientsController.deleteById));

// Client Portal is a Business Edition feature — every /portal/* route below requires
// the requesting team to hold a Business plan. The plain client CRUD routes above stay free.
clientsApiRouter.use("/portal", requireBusinessPlan);
clientsApiRouter.use("/:clientId/invoices", requireBusinessPlan);

// Organization-side Client Portal Request Management
clientsApiRouter.get("/portal/requests", safeControllerFunction(ClientsController.getClientRequests));
clientsApiRouter.get("/portal/requests/stats", safeControllerFunction(ClientsController.getClientRequestsStats));
clientsApiRouter.get("/portal/requests/:id", idParamValidator, safeControllerFunction(ClientsController.getClientRequestById));
clientsApiRouter.get("/portal/requests/:id/history", idParamValidator, safeControllerFunction(ClientsController.getClientRequestStatusHistory));
clientsApiRouter.get("/portal/requests/:id/comments", idParamValidator, safeControllerFunction(ClientsController.getClientRequestComments));
clientsApiRouter.post("/portal/requests/:id/comments", idParamValidator, safeControllerFunction(ClientsController.addClientRequestComment));
clientsApiRouter.put("/portal/requests/:id/status", idParamValidator, safeControllerFunction(ClientsController.updateClientRequestStatus));
clientsApiRouter.put("/portal/requests/:id/assign", idParamValidator, safeControllerFunction(ClientsController.assignClientRequest));

// Organization-side Client Portal Service Management
clientsApiRouter.get("/portal/services", safeControllerFunction(ClientsController.getClientServices));
clientsApiRouter.get("/portal/services/:id", idParamValidator, safeControllerFunction(ClientsController.getClientServiceById));
clientsApiRouter.post("/portal/services", safeControllerFunction(ClientsController.createClientService));
clientsApiRouter.put("/portal/services/:id", idParamValidator, safeControllerFunction(ClientsController.updateClientService));
clientsApiRouter.delete("/portal/services/:id", idParamValidator, safeControllerFunction(ClientsController.deleteClientService));

// Organization-side Client Portal Management (moved from client-portal-api-router.ts)
clientsApiRouter.get("/portal/clients", safeControllerFunction(ClientsController.getPortalClients));
clientsApiRouter.post("/portal/clients", phoneNumberValidator, safeControllerFunction(ClientsController.createPortalClient));

// Organization-side Client Portal Bulk Operations
// NOTE: These MUST be defined before the /:id parameterized routes to avoid Express
// matching "bulk-update" or "bulk-delete" as an :id parameter value.
clientsApiRouter.put("/portal/clients/bulk-update", safeControllerFunction(ClientsController.bulkUpdatePortalClients));
clientsApiRouter.delete("/portal/clients/bulk-delete", safeControllerFunction(ClientsController.bulkDeletePortalClients));

clientsApiRouter.get("/portal/clients/:id", idParamValidator, safeControllerFunction(ClientsController.getPortalClientById));
clientsApiRouter.get("/portal/clients/:id/details", idParamValidator, safeControllerFunction(ClientsController.getPortalClientDetails));
clientsApiRouter.put("/portal/clients/:id", idParamValidator, phoneNumberValidator, safeControllerFunction(ClientsController.updatePortalClient));
clientsApiRouter.delete("/portal/clients/:id", idParamValidator, safeControllerFunction(ClientsController.deletePortalClient));
clientsApiRouter.put("/portal/clients/:id/activate", idParamValidator, safeControllerFunction(ClientsController.activatePortalClient));

// Organization-side Client Portal Invite Slug (Vanity URLs)
clientsApiRouter.put("/portal/clients/:id/invite-slug", idParamValidator, safeControllerFunction(ClientsController.setClientInviteSlug));
clientsApiRouter.get("/portal/clients/:id/invite-slug/suggest", idParamValidator, safeControllerFunction(ClientsController.suggestClientInviteSlug));

// Organization-side Client Portal Projects
clientsApiRouter.get("/portal/clients/:id/projects", idParamValidator, safeControllerFunction(ClientsController.getPortalClientProjects));
clientsApiRouter.post("/portal/clients/:id/projects", idParamValidator, safeControllerFunction(ClientsController.assignProjectToPortalClient));
clientsApiRouter.delete("/portal/clients/:id/projects/:projectId", idParamValidator, safeControllerFunction(ClientsController.removeProjectFromPortalClient));

// Organization-side Client Portal Team Management
clientsApiRouter.get("/portal/clients/:id/team", idParamValidator, safeControllerFunction(ClientsController.getPortalClientTeam));
clientsApiRouter.post("/portal/clients/:id/team", idParamValidator, safeControllerFunction(ClientsController.invitePortalTeamMember));
clientsApiRouter.put("/portal/clients/:id/team/:memberId", idParamValidator, safeControllerFunction(ClientsController.updatePortalTeamMember));
clientsApiRouter.delete("/portal/clients/:id/team/:memberId", idParamValidator, safeControllerFunction(ClientsController.removePortalTeamMember));
clientsApiRouter.post("/portal/clients/:id/team/:memberId/resend-invitation", idParamValidator, safeControllerFunction(ClientsController.resendPortalTeamInvitation));

// Organization-side Client Portal Invitation Management
clientsApiRouter.post("/portal/generate-invitation-link", safeControllerFunction(ClientsController.generateClientInvitationLink));
clientsApiRouter.post("/portal/clients/:id/resend-invitation", idParamValidator, safeControllerFunction(ClientsController.resendClientInvitation));
clientsApiRouter.post("/portal/clients/:id/send-invitation", idParamValidator, safeControllerFunction(ClientsController.sendInvitationToExistingClient));

// Organization-side Client Portal Analytics
clientsApiRouter.get("/portal/clients/:id/stats", idParamValidator, safeControllerFunction(ClientsController.getPortalClientStats));
clientsApiRouter.get("/portal/clients/:id/activity", idParamValidator, safeControllerFunction(ClientsController.getPortalClientActivity));
clientsApiRouter.get("/portal/clients/:id/export", idParamValidator, safeControllerFunction(ClientsController.exportPortalClientData));

// Organization-side Client Portal Projects Management
clientsApiRouter.get("/portal/projects", safeControllerFunction(ClientsController.getPortalProjects));
clientsApiRouter.get("/portal/projects/:id", idParamValidator, safeControllerFunction(ClientsController.getPortalProjectById));

// Organization-side Client Portal Invoices Management  
clientsApiRouter.get("/portal/invoices", safeControllerFunction(ClientsController.getPortalInvoices));
clientsApiRouter.post("/portal/invoices", safeControllerFunction(ClientsController.createPortalInvoice));
clientsApiRouter.get("/portal/invoices/request/:requestId", safeControllerFunction(ClientPortalInvoicesController.getInvoicesByRequest));
clientsApiRouter.get("/portal/invoices/:id", idParamValidator, safeControllerFunction(ClientsController.getPortalInvoiceById));
clientsApiRouter.put("/portal/invoices/:id", idParamValidator, safeControllerFunction(ClientsController.updatePortalInvoice));
clientsApiRouter.delete("/portal/invoices/:id", idParamValidator, safeControllerFunction(ClientsController.deletePortalInvoice));
clientsApiRouter.post("/portal/invoices/:id/pay", idParamValidator, safeControllerFunction(ClientsController.payPortalInvoice));
clientsApiRouter.post("/portal/invoices/:id/send", idParamValidator, safeControllerFunction(ClientsController.sendPortalInvoice));
clientsApiRouter.post("/portal/invoices/:id/mark-paid", idParamValidator, safeControllerFunction(ClientsController.markPortalInvoiceAsPaid));
clientsApiRouter.get("/portal/invoices/:id/download", idParamValidator, safeControllerFunction(ClientsController.downloadPortalInvoice));

// Admin-only invoice download route (separate from client portal)
clientsApiRouter.get("/:clientId/invoices/:id/download", idParamValidator, safeControllerFunction(ClientsController.downloadPortalInvoice));

// Organization-side Client Portal Chats Management
clientsApiRouter.post("/portal/chats/upload", safeControllerFunction(ClientsController.uploadPortalChatFile));
clientsApiRouter.get("/portal/chats", safeControllerFunction(ClientsController.getPortalChats));
clientsApiRouter.post("/portal/chats", safeControllerFunction(ClientsController.createPortalChat));
clientsApiRouter.get("/portal/chats/:id", idParamValidator, safeControllerFunction(ClientsController.getPortalChatById));
clientsApiRouter.post("/portal/chats/:chatId/messages", chatIdParamValidator, safeControllerFunction(ClientsController.sendPortalMessage));
clientsApiRouter.get("/portal/chats/:chatId/messages", chatIdParamValidator, safeControllerFunction(ClientsController.getPortalMessages));

// Organization-side Client Portal Dashboard
clientsApiRouter.get("/portal/dashboard", safeControllerFunction(ClientsController.getPortalDashboard));

export default clientsApiRouter;
