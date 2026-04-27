import {compileTemplate} from "pug";
import db from "../config/db";
import {IDailyDigest} from "../interfaces/daily-digest";
import {IEmailTemplateType} from "../interfaces/email-template-type";
import {ITaskAssignmentsModel} from "../interfaces/task-assignments-model";
import {sendEmail} from "./email";
import FileConstants from "./file-constants";
import {log_error} from "./utils";
import {ITaskMovedToDoneRecord} from "../interfaces/task-moved-to-done";
import {IProjectDigest} from "../interfaces/project-digest";
import {ICommentEmailNotification, IProjectCommentEmailNotification} from "../interfaces/comment-email-notification";

const MAX_RETRY_ATTEMPTS = 3;

async function deleteTaskUpdate(updateId: string) {
  try {
    const q = "DELETE FROM task_updates WHERE id = $1;";
    await db.query(q, [updateId]);
  } catch (error) {
    log_error(error);
  }
}

async function incrementAttempts(updateId: string): Promise<number | null> {
  try {
    const q = "UPDATE task_updates SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts;";
    const result = await db.query(q, [updateId]);
    return result.rows[0]?.attempts ?? null;
  } catch (error) {
    log_error(error);
  }
  return null;
}

async function moveToFailedNotifications(updateId: string, errorMessage: string) {
  try {
    const q = `
      INSERT INTO failed_task_notifications (
        task_update_id, user_id, task_id, project_id, type, email, attempts, last_error, created_at
      )
      SELECT
        tu.id, tu.user_id, tu.task_id, tu.project_id, tu.type, u.email, tu.attempts, $2, tu.created_at
      FROM task_updates tu
      JOIN users u ON tu.user_id = u.id
      WHERE tu.id = $1
      ON CONFLICT (task_update_id) DO NOTHING;
    `;
    await db.query(q, [updateId, errorMessage]);
  } catch (error) {
    log_error(error);
  }
}

async function checkAndHandleMaxAttempts(updateId: string, currentAttempts: number, errorMessage: string) {
  if (currentAttempts >= MAX_RETRY_ATTEMPTS) {
    // This was the last attempt, move to failed notifications
    await moveToFailedNotifications(updateId, errorMessage);
    await deleteTaskUpdate(updateId);
    return true; // Exceeded max attempts
  }
  return false; // Still within retry limit
}

async function handleFailedTaskUpdates(updateIds: string[], errorMessage: string) {
  for (const updateId of updateIds) {
    const attempts = await incrementAttempts(updateId);
    if (attempts === null) continue;

    const exceededMax = await checkAndHandleMaxAttempts(updateId, attempts, errorMessage);
    if (exceededMax) {
      log_error(`Notification ${updateId} exceeded max retry attempts and was moved to failed_task_notifications`);
    }
  }
}

export async function sendAssignmentUpdate(
  toEmail: string,
  assignment: ITaskAssignmentsModel,
  updateIds: string[] = []
) {
  try {
    const template = FileConstants.getEmailTemplate(IEmailTemplateType.TaskAssigneeChange) as compileTemplate;
    const isSent = assignment.teams?.length
      ? await sendEmail({
        subject: "You have new assignments on Worklenz",
        to: [toEmail],
        html: template(assignment)
      })
      : true;

    if (isSent && updateIds.length > 0) {
      for (const updateId of updateIds) {
        await deleteTaskUpdate(updateId);
      }
    } else if (!isSent && updateIds.length > 0) {
      await handleFailedTaskUpdates(updateIds, "Email send returned no message id");
    }

    return !!isSent;
  } catch (e) {
    log_error(e);

    if (updateIds.length > 0) {
      await handleFailedTaskUpdates(updateIds, e instanceof Error ? e.message : "Email send failed");
    }

    return false;
  }
}

export async function sendDailyDigest(toEmail: string, digest: IDailyDigest) {
  try {
    const template = FileConstants.getEmailTemplate(IEmailTemplateType.DailyDigest) as compileTemplate;
    await sendEmail({
      subject: digest.note as string,
      to: [toEmail],
      html: template(digest)
    });
  } catch (e) {
    log_error(e);
  }
}

export async function sendTaskDone(toEmails: string[], data: ITaskMovedToDoneRecord) {
  try {
    const template = FileConstants.getEmailTemplate(IEmailTemplateType.TaskDone) as compileTemplate;
    await sendEmail({
      subject: data.summary,
      to: toEmails,
      html: template(data)
    });
  } catch (e) {
    log_error(e);
  }
}

export async function sendProjectDailyDigest(toEmail: string, digest: IProjectDigest) {
  try {
    const template = FileConstants.getEmailTemplate(IEmailTemplateType.ProjectDailyDigest) as compileTemplate;
    await sendEmail({
      subject: digest.summary,
      to: [toEmail],
      html: template(digest)
    });
  } catch (e) {
    log_error(e);
  }
}

export async function sendTaskComment(toEmail: string, data: ICommentEmailNotification) {
  try {
    const template = FileConstants.getEmailTemplate(IEmailTemplateType.TaskComment) as compileTemplate;
    return await sendEmail({
      subject: data.summary,
      to: [toEmail],
      html: template(data)
    });
  } catch (e) {
    log_error(e);
  }

  return null;
}

export async function sendProjectComment(toEmail: string, data: IProjectCommentEmailNotification) {
  try {
    const template = FileConstants.getEmailTemplate(IEmailTemplateType.ProjectComment) as compileTemplate;
    return await sendEmail({
      subject: data.summary,
      to: [toEmail],
      html: template(data)
    });
  } catch (e) {
    log_error(e);
  }

  return null;
}

// Client Portal Email Notifications

export interface IClientPortalNewRequestNotification {
  greeting: string;
  requestNumber: string;
  serviceName: string;
  clientName: string;
  submittedAt: string;
  requestTitle?: string;
  requestUrl: string;
  teamName: string;
}

export interface IClientPortalRequestCommentNotification {
  greeting: string;
  summary: string;
  senderName: string;
  senderType: 'client' | 'team_member';
  comment: string;
  requestNumber: string;
  serviceName: string;
  requestUrl: string;
  teamName: string;
}

export async function sendClientPortalNewRequestNotification(toEmails: string[], data: IClientPortalNewRequestNotification) {
  try {
    const template = FileConstants.getEmailTemplate(IEmailTemplateType.ClientPortalNewRequest) as compileTemplate;
    if (!template) {
      log_error("Client portal new request email template not found");
      return null;
    }
    return await sendEmail({
      subject: `New Request: ${data.requestNumber} - ${data.serviceName}`,
      to: toEmails,
      html: template(data)
    });
  } catch (e) {
    log_error(e);
  }
  return null;
}

export async function sendClientPortalRequestCommentNotification(toEmail: string, data: IClientPortalRequestCommentNotification) {
  try {
    const template = FileConstants.getEmailTemplate(IEmailTemplateType.ClientPortalRequestComment) as compileTemplate;
    if (!template) {
      log_error("Client portal request comment email template not found");
      return null;
    }
    return await sendEmail({
      subject: data.summary,
      to: [toEmail],
      html: template(data)
    });
  } catch (e) {
    log_error(e);
  }
  return null;
}
