import { Response } from "express";
import db from "../../../config/db";
import { ClientSubjectRequest } from "../../../middlewares/client-subject-middleware";
import { ServerResponse } from "../../../models/server-response";
import { recordApprovalDecision } from "../../../services/client-portal-v2/approvals.service";
import {
  accessClientFile,
  confirmClientUpload,
  listClientMentionOptions,
  listClientThreads,
  postClientComment,
  editClientMessage,
  deleteClientMessage,
  presignClientUpload,
  replyToChangeRequest,
  submitChangeRequest,
} from "../../../services/client-portal-v2/client-write.service";
import {
  getClientDashboard,
  getClientProject,
  listClientApprovals,
  listClientChangeRequests,
  listClientFiles,
  listClientMilestones,
  listClientProjects,
  listClientProjectsPaged,
  listClientTasks,
} from "../../../services/client-portal-v2/client-read.service";
import {
  cancelClientChangeRequest,
  getClientApproval,
  getClientChangeRequest,
  getClientThread,
  markClientThreadRead,
} from "../../../services/client-portal-v2/client-detail.service";
import { requestAccountDeletion } from "../../../services/client-portal-v2/client-account-deletion.service";
import {
  getDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
} from "../../../services/client-portal-v2/dashboard-layout.service";
import {
  getClientMe,
  getNotificationPrefs,
  listTimezones,
  updateClientMe,
  updateNotificationPrefs,
} from "../../../services/client-portal-v2/client-me.service";
import {
  listClientNotifications,
  markAllClientNotificationsRead,
  setClientNotificationRead,
} from "../../../services/client-portal-v2/client-notifications.service";
import {
  createOrganizationInviteLink,
  listOrganizationUsers,
  listProjectMembers,
  setProjectMembers,
  getOrganizationUserProjects,
  removeOrganizationUser,
  resendOrganizationInvite,
  setOrganizationUserProjects,
  updateOrganizationUser,
} from "../../../services/client-portal-v2/client-organization.service";
import { PortalError, badRequest } from "../../../services/client-portal-v2/errors";
import { ClientSubject } from "../../../services/client-portal-v2/subject";
import { splitList } from "../../../services/client-portal-v2/list-params";
import { isValidUuid } from "../../../shared/validation-helpers";
import { asNumber, asString, handlePortalError } from "./portal-http";

/**
 * Client Portal v2 client API (`/api/client-portal/v2`). Every route runs behind `authenticateClient`
 * and `requireClientSubject`, so by the time a handler runs the user is Active, their role is read
 * fresh from the database, and `req.clientSubject` is set. Handlers only ever call the client read
 * and write services, which hold the gating chain and the allow-list serializers.
 */

type ClientHandler = (req: ClientSubjectRequest, subject: ClientSubject, res: Response) => Promise<unknown>;

const clientHandler =
  (fallbackMessage: string, fn: ClientHandler) => async (req: ClientSubjectRequest, res: Response) => {
    try {
      const subject = req.clientSubject;
      if (!subject) throw new PortalError(403, "Your access has been removed", "ACCESS_REVOKED");
      await fn(req, subject, res);
    } catch (error) {
      handlePortalError(res as any, error, fallbackMessage);
    }
  };

const send = <T>(res: Response, body: T, message: string | null = null, status = 200) =>
  res.status(status).json(new ServerResponse(true, body, message));

const uuid = (req: ClientSubjectRequest, name: string): string => {
  const value = req.params[name];
  if (typeof value !== "string" || !isValidUuid(value)) throw badRequest(`Invalid ${name}`, "INVALID_ID");
  return value;
};

const bodyOf = (req: ClientSubjectRequest): Record<string, any> =>
  req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Record<string, any>) : {};

export default class ClientPortalV2Controller {
  /** GET /me - who this is, what their role allows, and the operator switches that shape the app. */
  static me = clientHandler("Failed to load your account", async (_req, subject, res) => {
    send(res, await getClientMe(db, subject));
  });

  static updateMe = clientHandler("Failed to save your changes", async (req, subject, res) => {
    send(res, await updateClientMe(db, subject, bodyOf(req)), "Saved");
  });

  /** POST /me/account-deletion - soft-deletes the signed-in person's login; support purges it after 30 days. */
  static requestAccountDeletion = clientHandler("Failed to delete your account", async (req, subject, res) => {
    send(res, await requestAccountDeletion(subject, bodyOf(req)), "Account deletion request submitted");
  });

  static timezones = clientHandler("Failed to load the time zones", async (_req, _subject, res) => {
    send(res, await listTimezones(db));
  });

  static notificationPrefs = clientHandler("Failed to load your notification settings", async (_req, subject, res) => {
    send(res, await getNotificationPrefs(db, subject));
  });

  static updateNotificationPrefs = clientHandler("Failed to save your notification settings", async (req, subject, res) => {
    send(res, await updateNotificationPrefs(db, subject, bodyOf(req)));
  });

  static dashboardLayout = clientHandler("Failed to load your dashboard layout", async (_req, subject, res) => {
    send(res, await getDashboardLayout(db, subject));
  });

  static saveDashboardLayout = clientHandler("Failed to save your dashboard layout", async (req, subject, res) => {
    send(res, await saveDashboardLayout(db, subject, bodyOf(req).layout), "Saved");
  });

  static resetDashboardLayout = clientHandler("Failed to reset your dashboard layout", async (_req, subject, res) => {
    send(res, await resetDashboardLayout(db, subject), "Reset");
  });

  static dashboard = clientHandler("Failed to load the dashboard", async (_req, subject, res) => {
    send(res, await getClientDashboard(db, subject));
  });

  /** GET /projects - the array of every shared project, or `{ data, total }` when `page`/`size` are given. */
  static projects = clientHandler("Failed to load your projects", async (req, subject, res) => {
    const { page, size, search, sort, order, status, phase } = req.query as Record<string, string | undefined>;
    if (page === undefined && size === undefined) {
      send(res, await listClientProjects(db, subject));
      return;
    }
    send(
      res,
      await listClientProjectsPaged(db, subject, {
        page: Number(page ?? 1),
        size: Number(size ?? 10),
        search,
        sort,
        order: order === "desc" ? "desc" : "asc",
        status: splitList(status),
        phase: splitList(phase),
      })
    );
  });

  static mentionOptions = clientHandler("Failed to load the people you can mention", async (req, subject, res) => {
    send(res, await listClientMentionOptions(subject, uuid(req, "projectId")));
  });

  static projectMembers = clientHandler("Failed to load the project members", async (req, subject, res) => {
    send(res, await listProjectMembers(subject, uuid(req, "projectId")));
  });

  static setProjectMembers = clientHandler("Failed to save the project members", async (req, subject, res) => {
    send(res, await setProjectMembers(subject, uuid(req, "projectId"), bodyOf(req)), "Saved");
  });

  static project = clientHandler("Failed to load the project", async (req, subject, res) => {
    send(res, await getClientProject(db, subject, uuid(req, "projectId")));
  });

  static milestones = clientHandler("Failed to load the milestones", async (req, subject, res) => {
    send(res, await listClientMilestones(db, subject, uuid(req, "projectId")));
  });

  static tasks = clientHandler("Failed to load the tasks", async (req, subject, res) => {
    send(res, await listClientTasks(db, subject, uuid(req, "projectId")));
  });

  static files = clientHandler("Failed to load the files", async (req, subject, res) => {
    send(res, await listClientFiles(db, subject, uuid(req, "projectId")));
  });

  /** GET /files/:fileId/access?action=preview|download&version=n - a short-lived link, authorized per request. */
  static fileAccess = clientHandler("Failed to open the file", async (req, subject, res) => {
    const action = asString(req.query.action);
    if (action !== "preview" && action !== "download") throw badRequest("action must be preview or download", "INVALID_ACTION");
    const version = asNumber(req.query.version);
    send(res, await accessClientFile(subject, { fileId: uuid(req, "fileId"), version, action }));
  });

  static presignUpload = clientHandler("Failed to start the upload", async (req, subject, res) => {
    send(res, await presignClientUpload(subject, uuid(req, "projectId"), bodyOf(req)));
  });

  static confirmUpload = clientHandler("Failed to finish the upload", async (req, subject, res) => {
    const fileId = asString(bodyOf(req).file_id);
    if (!fileId) throw badRequest("file_id is required", "MISSING_FIELDS");
    send(res, await confirmClientUpload(subject, uuid(req, "projectId"), fileId));
  });

  static approvals = clientHandler("Failed to load the approvals", async (_req, subject, res) => {
    send(res, await listClientApprovals(db, subject));
  });

  static approval = clientHandler("Failed to load the approval", async (req, subject, res) => {
    send(res, await getClientApproval(db, subject, uuid(req, "approvalId")));
  });

  /**
   * POST /approvals/:approvalId/decision  body: { outcome, comment, confirm_empty } - idempotent, and only
   * for a named approver who is a Client Admin.
   */
  static decide = clientHandler("Failed to record your decision", async (req, subject, res) => {
    const body = bodyOf(req);
    const result = await recordApprovalDecision({
      teamId: subject.teamId,
      approvalId: uuid(req, "approvalId"),
      subject,
      outcome: body.outcome,
      comment: asString(body.comment),
      confirmEmpty: body.confirm_empty === true,
    });
    send(res, result, result.recorded ? "Your decision was recorded" : "A decision was already recorded");
  });

  static changeRequests = clientHandler("Failed to load your change requests", async (_req, subject, res) => {
    send(res, await listClientChangeRequests(db, subject));
  });

  static changeRequest = clientHandler("Failed to load the change request", async (req, subject, res) => {
    send(res, await getClientChangeRequest(db, subject, uuid(req, "changeRequestId")));
  });

  static cancelChangeRequest = clientHandler("Failed to cancel the change request", async (req, subject, res) => {
    await cancelClientChangeRequest(subject, uuid(req, "changeRequestId"));
    send(res, null, "Cancelled");
  });

  static submitChangeRequest = clientHandler("Failed to submit the change request", async (req, subject, res) => {
    send(res, await submitChangeRequest(subject, bodyOf(req)), "Change request submitted", 201);
  });

  static replyChangeRequest = clientHandler("Failed to send your reply", async (req, subject, res) => {
    await replyToChangeRequest(subject, uuid(req, "changeRequestId"), asString(bodyOf(req).text) ?? "");
    send(res, null, "Reply sent", 201);
  });

  static threads = clientHandler("Failed to load the discussions", async (req, subject, res) => {
    send(res, await listClientThreads(subject, asString(req.query.project_id)));
  });

  static thread = clientHandler("Failed to load the discussion", async (req, subject, res) => {
    send(res, await getClientThread(subject, uuid(req, "threadId")));
  });

  static markThreadRead = clientHandler("Failed to mark the discussion read", async (req, subject, res) => {
    await markClientThreadRead(subject, uuid(req, "threadId"));
    send(res, null);
  });

  static notifications = clientHandler("Failed to load your notifications", async (_req, subject, res) => {
    send(res, await listClientNotifications(db, subject));
  });

  static markNotificationRead = (read: boolean) =>
    clientHandler("Failed to update the notification", async (req, subject, res) => {
      await setClientNotificationRead(db, subject, uuid(req, "notificationId"), read);
      send(res, null);
    });

  static markAllNotificationsRead = clientHandler("Failed to update your notifications", async (_req, subject, res) => {
    await markAllClientNotificationsRead(db, subject);
    send(res, null);
  });

  static organizationUsers = clientHandler("Failed to load the people in your organization", async (_req, subject, res) => {
    send(res, await listOrganizationUsers(db, subject));
  });

  static createInviteLink = clientHandler("Failed to create the invite link", async (req, subject, res) => {
    send(res, await createOrganizationInviteLink(subject, bodyOf(req).email, bodyOf(req).send_email === true), "Invite link created", 201);
  });

  static updateOrganizationUser = clientHandler("Failed to save your changes", async (req, subject, res) => {
    send(res, await updateOrganizationUser(subject, uuid(req, "userId"), bodyOf(req)), "Saved");
  });

  static resendOrganizationInvite = clientHandler("Failed to send the invitation", async (req, subject, res) => {
    send(res, await resendOrganizationInvite(subject, uuid(req, "userId"), bodyOf(req).send_email === true), "Invitation sent", 201);
  });

  static organizationUserProjects = clientHandler("Failed to load this person's projects", async (req, subject, res) => {
    send(res, await getOrganizationUserProjects(subject, uuid(req, "userId")));
  });

  static setOrganizationUserProjects = clientHandler("Failed to save this person's projects", async (req, subject, res) => {
    send(res, await setOrganizationUserProjects(subject, uuid(req, "userId"), bodyOf(req).project_ids), "Saved");
  });

  static removeOrganizationUser = clientHandler("Failed to remove this person", async (req, subject, res) => {
    await removeOrganizationUser(subject, uuid(req, "userId"));
    send(res, null, "Removed");
  });

  static comment = clientHandler("Failed to send your comment", async (req, subject, res) => {
    const body = bodyOf(req);
    send(
      res,
      await postClientComment(subject, {
        thread_id: asString(body.thread_id),
        project_id: asString(body.project_id),
        context: body.context,
        text: asString(body.text),
        visibility: body.visibility,
        mention_ids: body.mention_ids,
        attachment_file_ids: body.attachment_file_ids,
        parent_message_id: body.parent_message_id,
      }),
      "Comment sent",
      201
    );
  });

  static editMessage = clientHandler("Failed to save your message", async (req, subject, res) => {
    const body = bodyOf(req);
    send(res, await editClientMessage(subject, uuid(req, "messageId"), { text: asString(body.text), mention_ids: body.mention_ids }), "Message updated");
  });

  static deleteMessage = clientHandler("Failed to delete your message", async (req, subject, res) => {
    send(res, await deleteClientMessage(subject, uuid(req, "messageId")), "Message deleted");
  });
}
