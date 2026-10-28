import express from "express";

import ClientsController from "../../controllers/clients-controller";
import ClientPortalInvoicesController from "../../controllers/client-portal/client-portal-invoices-controller";
import ClientPortalQuotesController from "../../controllers/client-portal/client-portal-quotes-controller";
import ClientPortalCompanyUsersController from "../../controllers/client-portal/client-portal-company-users-controller";
import ClientPortalOnboardingController from "../../controllers/client-portal/client-portal-onboarding-controller";
import clientPortalV2AdminRouter from "./client-portal-v2-admin-router";

import clientsBodyValidator from "../../middlewares/validators/clients-body-validator";
import idParamValidator from "../../middlewares/validators/id-param-validator";
import userIdParamValidator from "../../middlewares/validators/user-id-param-validator";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import canViewClientTeamValidator from "../../middlewares/validators/can-view-client-team-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import projectManagerValidator from "../../middlewares/validators/project-manager-validator";
import chatIdParamValidator from "../../middlewares/validators/chat-id-param-validator";
import phoneNumberValidator from "../../middlewares/validators/phone-number-validator";
import { requireFeature } from "../../shared/entitlements/gates";
import { ServerResponse } from "../../models/server-response";
import PortalProjectsController from "../../controllers/client-portal/v2/portal-projects-controller";

const clientsApiRouter = express.Router();

/**
 * Legacy (v1) client-portal writes that skip the v2 safeguards: no last-admin or sole-approver check, no
 * audit entry, and some delete the shared login of a person who also belongs to other portals. The admin
 * console no longer calls any of them; the v2 routes under /portal/v2 do the same jobs safely. They answer
 * 410 so a stale client gets a clear message instead of a silent, unprotected change.
 */
const movedInV2: express.RequestHandler = (_req, res) =>
  res
    .status(410)
    .json(
      new ServerResponse(
        false,
        { code: "MOVED_IN_V2" },
        "This action has moved. Use the Clients and Client Users pages of the Client Portal admin console."
      )
    );

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
clientsApiRouter.use("/portal", requireFeature("client_portal"));
clientsApiRouter.use("/:clientId/invoices", requireFeature("client_portal_invoices"));

// Read-only Client's team list for the project Members tab. Registered before the Owner/Admin
// portal guard so eligible project members can load assigned client users when allowed.
clientsApiRouter.get(
  "/portal/v2/projects/:projectId/access",
  canViewClientTeamValidator,
  safeControllerFunction(PortalProjectsController.access)
);

// Every Client Portal admin route is Owner/Admin only. Most of /portal/* previously had no role check,
// so any signed-in member could reach it by URL; the guard is applied once here for all of it.
clientsApiRouter.use("/portal", teamOwnerOrAdminValidator);

// Client Portal v2 admin API (roles, settings, projects, approvals, change requests, discussions,
// audit log, preview). Namespaced under /v2 so it never collides with the v1 routes below.
clientsApiRouter.use("/portal/v2", clientPortalV2AdminRouter);

// Organization-side Client Portal Request Management
clientsApiRouter.get("/portal/requests", safeControllerFunction(ClientsController.getClientRequests));
clientsApiRouter.get("/portal/requests/stats", safeControllerFunction(ClientsController.getClientRequestsStats));
clientsApiRouter.get("/portal/requests/:id", idParamValidator, safeControllerFunction(ClientsController.getClientRequestById));
clientsApiRouter.get("/portal/requests/:id/history", idParamValidator, safeControllerFunction(ClientsController.getClientRequestStatusHistory));
clientsApiRouter.get("/portal/requests/:id/comments", idParamValidator, safeControllerFunction(ClientsController.getClientRequestComments));
clientsApiRouter.post("/portal/requests/:id/comments", idParamValidator, safeControllerFunction(ClientsController.addClientRequestComment));
clientsApiRouter.put("/portal/requests/:id/status", idParamValidator, safeControllerFunction(ClientsController.updateClientRequestStatus));
clientsApiRouter.put("/portal/requests/:id/assign", idParamValidator, safeControllerFunction(ClientsController.assignClientRequest));
clientsApiRouter.delete("/portal/requests/:id", idParamValidator, safeControllerFunction(ClientsController.deleteClientRequest));

// Organization-side custom request statuses (team-defined, layered on top of the 5 built-ins)
clientsApiRouter.get("/portal/request-custom-statuses", safeControllerFunction(ClientsController.getRequestCustomStatuses));
clientsApiRouter.post("/portal/request-custom-statuses", safeControllerFunction(ClientsController.createRequestCustomStatus));
clientsApiRouter.delete("/portal/request-custom-statuses/:id", idParamValidator, safeControllerFunction(ClientsController.deleteRequestCustomStatus));

// Organization-side Client Portal Ticket Management (admin queue only — see clients-controller.ts)
clientsApiRouter.get("/portal/tickets", safeControllerFunction(ClientsController.getClientTickets));
// NOTE: Must be defined before /portal/tickets/:id so "stats" is not read as a ticket id.
clientsApiRouter.get("/portal/tickets/stats", safeControllerFunction(ClientsController.getClientTicketsStats));
clientsApiRouter.get("/portal/tickets/:id", idParamValidator, safeControllerFunction(ClientsController.getClientTicketById));
clientsApiRouter.get("/portal/tickets/:id/comments", idParamValidator, safeControllerFunction(ClientsController.getClientTicketComments));
clientsApiRouter.post("/portal/tickets/:id/comments", idParamValidator, safeControllerFunction(ClientsController.addClientTicketComment));
clientsApiRouter.put("/portal/tickets/:id/status", idParamValidator, safeControllerFunction(ClientsController.updateClientTicketStatus));
clientsApiRouter.post("/portal/tickets/:id/convert-to-task", idParamValidator, safeControllerFunction(ClientsController.convertClientTicketToTask));
clientsApiRouter.get("/portal/tickets/:id/attachments", idParamValidator, safeControllerFunction(ClientsController.getClientTicketAttachments));
clientsApiRouter.post("/portal/tickets/:id/attachments", idParamValidator, safeControllerFunction(ClientsController.uploadClientTicketAttachment));
clientsApiRouter.delete("/portal/tickets/:id/attachments/:attachmentId", idParamValidator, safeControllerFunction(ClientsController.deleteClientTicketAttachment));

// Organization-side custom ticket statuses (team-defined, layered on top of the 3 built-ins).
// Unlike request-custom-statuses, deletion is blocked while any ticket still holds the status (FR-02).
clientsApiRouter.get("/portal/ticket-custom-statuses", safeControllerFunction(ClientsController.getTicketCustomStatuses));
clientsApiRouter.post("/portal/ticket-custom-statuses", safeControllerFunction(ClientsController.createTicketCustomStatus));
clientsApiRouter.delete("/portal/ticket-custom-statuses/:id", idParamValidator, safeControllerFunction(ClientsController.deleteTicketCustomStatus));

// Organization-side Client Portal Service Management
clientsApiRouter.get("/portal/services", safeControllerFunction(ClientsController.getClientServices));
clientsApiRouter.get("/portal/services/:id", idParamValidator, safeControllerFunction(ClientsController.getClientServiceById));
clientsApiRouter.post("/portal/services", safeControllerFunction(ClientsController.createClientService));
clientsApiRouter.put("/portal/services/:id", idParamValidator, safeControllerFunction(ClientsController.updateClientService));
clientsApiRouter.delete("/portal/services/:id", idParamValidator, safeControllerFunction(ClientsController.deleteClientService));

// Organization-side team-defined Category / Billing type picklist values (layered on top of
// each field's built-in options, the same relationship request-custom-statuses has to status)
clientsApiRouter.get("/portal/service-option-values", safeControllerFunction(ClientsController.getServiceOptionValues));
clientsApiRouter.post("/portal/service-option-values", safeControllerFunction(ClientsController.createServiceOptionValue));
clientsApiRouter.delete("/portal/service-option-values/:id", idParamValidator, safeControllerFunction(ClientsController.deleteServiceOptionValue));

// Organization-side Client Portal Management (moved from client-portal-api-router.ts)
clientsApiRouter.get("/portal/clients", safeControllerFunction(ClientsController.getPortalClients));
clientsApiRouter.post("/portal/clients", teamOwnerOrAdminValidator, phoneNumberValidator, safeControllerFunction(ClientsController.createPortalClient));
// NOTE: Must be defined before the /portal/clients/:id routes so "stats" is not read as an :id.
clientsApiRouter.get("/portal/clients/stats", safeControllerFunction(ClientsController.getPortalClientsStats));

// Organization-side Client Portal Bulk Operations (retired: they wrote client_users.status for logins shared
// across workspaces and had no audit trail).
// NOTE: These MUST be defined before the /:id parameterized routes to avoid Express
// matching "bulk-update" or "bulk-delete" as an :id parameter value.
clientsApiRouter.put("/portal/clients/bulk-update", movedInV2);
clientsApiRouter.delete("/portal/clients/bulk-delete", movedInV2);

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

// Organization-side Client Portal Team Management (writes retired, see movedInV2; the v2 client-users routes replace them)
clientsApiRouter.get("/portal/clients/:id/team", idParamValidator, safeControllerFunction(ClientsController.getPortalClientTeam));
clientsApiRouter.post("/portal/clients/:id/team", idParamValidator, movedInV2);
clientsApiRouter.put("/portal/clients/:id/team/:memberId", idParamValidator, movedInV2);
clientsApiRouter.delete("/portal/clients/:id/team/:memberId", idParamValidator, movedInV2);
clientsApiRouter.post("/portal/clients/:id/team/:memberId/resend-invitation", idParamValidator, movedInV2);

// Organization-side Client Portal Company Users (the people at each client company).
// Wired straight to the controller: it already reads req.user and returns real HTTP statuses.
// Mutating routes are admin-only, matching the frontend AdminGuard for the client portal.
// NOTE: "stats" must be declared before /:userId so it is not read as a user id.
clientsApiRouter.get("/portal/company-users", safeControllerFunction(ClientPortalCompanyUsersController.list));
clientsApiRouter.get("/portal/company-users/stats", safeControllerFunction(ClientPortalCompanyUsersController.stats));
clientsApiRouter.get("/portal/company-users/:userId", userIdParamValidator, safeControllerFunction(ClientPortalCompanyUsersController.getById));
clientsApiRouter.put("/portal/company-users/:userId", teamOwnerOrAdminValidator, userIdParamValidator, safeControllerFunction(ClientPortalCompanyUsersController.update));
// Role, status and removal are retired: v1 had no last-admin or sole-approver check and no audit entry, and
// `remove` deleted the shared login. Use PUT/POST/DELETE /portal/v2/client-users/:userId.
clientsApiRouter.put("/portal/company-users/:userId/role", teamOwnerOrAdminValidator, userIdParamValidator, movedInV2);
clientsApiRouter.put("/portal/company-users/:userId/status", teamOwnerOrAdminValidator, userIdParamValidator, movedInV2);
clientsApiRouter.put("/portal/company-users/:userId/projects", teamOwnerOrAdminValidator, userIdParamValidator, safeControllerFunction(ClientPortalCompanyUsersController.setProjects));
clientsApiRouter.post("/portal/company-users/:userId/invite", teamOwnerOrAdminValidator, userIdParamValidator, safeControllerFunction(ClientPortalCompanyUsersController.invite));
clientsApiRouter.delete("/portal/company-users/:userId", teamOwnerOrAdminValidator, userIdParamValidator, movedInV2);

// Organization-side Add Client wizard writes. Admin-only, like the other company-user writes.
// NOTE: These POST paths do not clash with the /portal/clients/:id routes (different verbs and
// depth), but keep them next to each other so the static "onboard" / "import" segments stay clear.
clientsApiRouter.post("/portal/clients/onboard", teamOwnerOrAdminValidator, safeControllerFunction(ClientPortalOnboardingController.onboard));
clientsApiRouter.post("/portal/clients/import/validate", teamOwnerOrAdminValidator, safeControllerFunction(ClientPortalOnboardingController.importValidate));
clientsApiRouter.post("/portal/clients/import", teamOwnerOrAdminValidator, safeControllerFunction(ClientPortalOnboardingController.importCommit));
clientsApiRouter.post("/portal/clients/:id/company-users", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(ClientPortalOnboardingController.addCompanyUser));

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
clientsApiRouter.put("/portal/invoices/:id/payment", idParamValidator, safeControllerFunction(ClientsController.recordPortalInvoicePayment));
clientsApiRouter.post("/portal/invoices/:id/duplicate", idParamValidator, safeControllerFunction(ClientsController.duplicatePortalInvoice));
clientsApiRouter.get("/portal/invoices/:id/download", idParamValidator, safeControllerFunction(ClientsController.downloadPortalInvoice));

// Admin-only invoice download route (separate from client portal)
clientsApiRouter.get("/:clientId/invoices/:id/download", idParamValidator, safeControllerFunction(ClientsController.downloadPortalInvoice));

// Organization-side Client Portal Quotes Management
clientsApiRouter.get("/portal/quotes", safeControllerFunction(ClientPortalQuotesController.getQuotes));
clientsApiRouter.post("/portal/quotes", safeControllerFunction(ClientPortalQuotesController.createQuote));
clientsApiRouter.get("/portal/quotes/:id", idParamValidator, safeControllerFunction(ClientPortalQuotesController.getQuoteDetails));
clientsApiRouter.delete("/portal/quotes/:id", idParamValidator, safeControllerFunction(ClientPortalQuotesController.deleteQuote));
clientsApiRouter.put("/portal/quotes/:id/status", idParamValidator, safeControllerFunction(ClientPortalQuotesController.updateQuoteStatus));
clientsApiRouter.post("/portal/quotes/:id/duplicate", idParamValidator, safeControllerFunction(ClientPortalQuotesController.duplicateQuote));
clientsApiRouter.get("/portal/quotes/:id/download", idParamValidator, safeControllerFunction(ClientPortalQuotesController.downloadQuote));

// Organization-side Client Portal Chats Management
clientsApiRouter.post("/portal/chats/upload", safeControllerFunction(ClientsController.uploadPortalChatFile));
clientsApiRouter.get("/portal/chats", safeControllerFunction(ClientsController.getPortalChats));
// Registered before "/portal/chats/:id" so "conversations" is not read as a chat id
clientsApiRouter.get("/portal/chats/conversations", safeControllerFunction(ClientsController.getPortalChatConversations));
clientsApiRouter.post("/portal/chats", safeControllerFunction(ClientsController.createPortalChat));
clientsApiRouter.get("/portal/chats/:id", idParamValidator, safeControllerFunction(ClientsController.getPortalChatById));
clientsApiRouter.post("/portal/chats/:chatId/messages", chatIdParamValidator, safeControllerFunction(ClientsController.sendPortalMessage));
clientsApiRouter.get("/portal/chats/:chatId/messages", chatIdParamValidator, safeControllerFunction(ClientsController.getPortalMessages));

// Organization-side Client Portal Dashboard
clientsApiRouter.get("/portal/dashboard", safeControllerFunction(ClientsController.getPortalDashboard));

export default clientsApiRouter;
