import express from "express";

import ClientsController from "../../controllers/clients-controller";

import clientsBodyValidator from "../../middlewares/validators/clients-body-validator";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectManagerValidator from "../../middlewares/validators/project-manager-validator";

const clientsApiRouter = express.Router();

clientsApiRouter.post("/", projectManagerValidator, clientsBodyValidator, safeControllerFunction(ClientsController.create));
clientsApiRouter.get("/", safeControllerFunction(ClientsController.get));
clientsApiRouter.get("/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(ClientsController.getById));
clientsApiRouter.put("/:id", teamOwnerOrAdminValidator, clientsBodyValidator, idParamValidator, safeControllerFunction(ClientsController.update));
clientsApiRouter.delete("/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(ClientsController.deleteById));

// Organization-side Client Portal Request Management
clientsApiRouter.get("/portal/requests", safeControllerFunction(ClientsController.getClientRequests));
clientsApiRouter.get("/portal/requests/stats", safeControllerFunction(ClientsController.getClientRequestsStats));
clientsApiRouter.get("/portal/requests/:id", idParamValidator, safeControllerFunction(ClientsController.getClientRequestById));
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
clientsApiRouter.post("/portal/clients", safeControllerFunction(ClientsController.createPortalClient));
clientsApiRouter.get("/portal/clients/:id", idParamValidator, safeControllerFunction(ClientsController.getPortalClientById));
clientsApiRouter.get("/portal/clients/:id/details", idParamValidator, safeControllerFunction(ClientsController.getPortalClientDetails));
clientsApiRouter.put("/portal/clients/:id", idParamValidator, safeControllerFunction(ClientsController.updatePortalClient));
clientsApiRouter.delete("/portal/clients/:id", idParamValidator, safeControllerFunction(ClientsController.deletePortalClient));

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

// Organization-side Client Portal Analytics
clientsApiRouter.get("/portal/clients/:id/stats", idParamValidator, safeControllerFunction(ClientsController.getPortalClientStats));
clientsApiRouter.get("/portal/clients/:id/activity", idParamValidator, safeControllerFunction(ClientsController.getPortalClientActivity));
clientsApiRouter.get("/portal/clients/:id/export", idParamValidator, safeControllerFunction(ClientsController.exportPortalClientData));

// Organization-side Client Portal Bulk Operations
clientsApiRouter.put("/portal/clients/bulk-update", safeControllerFunction(ClientsController.bulkUpdatePortalClients));
clientsApiRouter.delete("/portal/clients/bulk-delete", safeControllerFunction(ClientsController.bulkDeletePortalClients));

// Organization-side Client Portal Projects Management
clientsApiRouter.get("/portal/projects", safeControllerFunction(ClientsController.getPortalProjects));
clientsApiRouter.get("/portal/projects/:id", idParamValidator, safeControllerFunction(ClientsController.getPortalProjectById));

// Organization-side Client Portal Invoices Management  
clientsApiRouter.get("/portal/invoices", safeControllerFunction(ClientsController.getPortalInvoices));
clientsApiRouter.get("/portal/invoices/:id", idParamValidator, safeControllerFunction(ClientsController.getPortalInvoiceById));
clientsApiRouter.post("/portal/invoices/:id/pay", idParamValidator, safeControllerFunction(ClientsController.payPortalInvoice));
clientsApiRouter.get("/portal/invoices/:id/download", idParamValidator, safeControllerFunction(ClientsController.downloadPortalInvoice));

// Organization-side Client Portal Chats Management
clientsApiRouter.get("/portal/chats", safeControllerFunction(ClientsController.getPortalChats));
clientsApiRouter.get("/portal/chats/:id", idParamValidator, safeControllerFunction(ClientsController.getPortalChatById));
clientsApiRouter.post("/portal/chats/:chatId/messages", idParamValidator, safeControllerFunction(ClientsController.sendPortalMessage));
clientsApiRouter.get("/portal/chats/:chatId/messages", idParamValidator, safeControllerFunction(ClientsController.getPortalMessages));

// Organization-side Client Portal Dashboard
clientsApiRouter.get("/portal/dashboard", safeControllerFunction(ClientsController.getPortalDashboard));

export default clientsApiRouter;
