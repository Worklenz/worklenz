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

async function updateTaskUpdatesStatus(isSent: boolean) {
  try {
    const q = isSent
      ? "DELETE FROM task_updates WHERE is_sent IS TRUE;"
      : "UPDATE task_updates SET is_sent = FALSE;";

    await db.query(q, []);
  } catch (error) {
    log_error(error);
  }
}


async function addToEmailLogs(email: string, subject: string, html: string) {
  try {
    const q = `INSERT INTO email_logs (email, subject, html) VALUES ($1, $2, $3);`;
    await db.query(q, [email, subject, html]);
  } catch (error) {
    log_error(error);
  }
}


export async function sendAssignmentUpdate(toEmail: string, assignment: ITaskAssignmentsModel) {
  try {
    const template = FileConstants.getEmailTemplate(IEmailTemplateType.TaskAssigneeChange) as compileTemplate;
    const isSent = assignment.teams?.length
      ? await sendEmail({
        subject: "You have new assignments on Worklenz",
        to: [toEmail],
        html: template(assignment)
      })
      : true;

    await updateTaskUpdatesStatus(!!isSent);
    addToEmailLogs(toEmail, "You have new assignments on Worklenz", template(assignment));
  } catch (e) {
    log_error(e);
    await updateTaskUpdatesStatus(false);
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
