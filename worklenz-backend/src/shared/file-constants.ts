/* eslint-disable security/detect-object-injection */
import fs from "node:fs";
import path from "node:path";
import pug from "pug";
import {IEmailTemplateType} from "../interfaces/email-template-type";

class FileConstants {
  private static release: string | null = null;
  private static readonly EMAIL_TEMPLATES_MAP: { [x: string]: string } = {};
  private static readonly PUG_EMAIL_TEMPLATES_MAP: { [x: string]: pug.compileTemplate } = {};
  private static readonly EMAIL_TEMPLATES_BASE = "../../worklenz-email-templates";

  static init() {
    FileConstants.getRelease();
    FileConstants.initEmailTemplates();
  }

  private static readHtmlEmailTemplate(fileName: string) {
    const key = fileName.toString();

    if (!FileConstants.EMAIL_TEMPLATES_MAP[key]) {
      const url = path.join(__dirname, FileConstants.EMAIL_TEMPLATES_BASE, `${fileName}.html`);
      FileConstants.EMAIL_TEMPLATES_MAP[key] = fs.readFileSync(url, "utf8");
    }

    return FileConstants.EMAIL_TEMPLATES_MAP[key];
  }

  private static readPugEmailTemplate(fileName: string) {
    const key = fileName.toString();

    if (!FileConstants.PUG_EMAIL_TEMPLATES_MAP[key]) {
      const filePath = path.join(__dirname, FileConstants.EMAIL_TEMPLATES_BASE, "email-notifications", `${fileName}.pug`);
      const template = pug.compileFile(filePath);
      FileConstants.PUG_EMAIL_TEMPLATES_MAP[key] = template;
    }

    return FileConstants.PUG_EMAIL_TEMPLATES_MAP[key];
  }

  private static initEmailTemplates() {
    FileConstants.getEmailTemplate(IEmailTemplateType.NewSubscriber);
    FileConstants.getEmailTemplate(IEmailTemplateType.TeamMemberInvitation);
    FileConstants.getEmailTemplate(IEmailTemplateType.UnregisteredTeamMemberInvitation);
    FileConstants.getEmailTemplate(IEmailTemplateType.PasswordChange);
    FileConstants.getEmailTemplate(IEmailTemplateType.Welcome);
    FileConstants.getEmailTemplate(IEmailTemplateType.OTPVerification);
    FileConstants.getEmailTemplate(IEmailTemplateType.ResetPassword);
    FileConstants.getEmailTemplate(IEmailTemplateType.TaskAssigneeChange);
    FileConstants.getEmailTemplate(IEmailTemplateType.DailyDigest);
    FileConstants.getEmailTemplate(IEmailTemplateType.TaskDone);
    FileConstants.getEmailTemplate(IEmailTemplateType.ProjectDailyDigest);
    FileConstants.getEmailTemplate(IEmailTemplateType.TaskComment);
    FileConstants.getEmailTemplate(IEmailTemplateType.ClientInvitation);
  }

  static getEmailTemplate(type: IEmailTemplateType) {
    switch (type) {
      case IEmailTemplateType.NewSubscriber:
        return FileConstants.readHtmlEmailTemplate("admin-new-subscriber-notification");
      case IEmailTemplateType.TeamMemberInvitation:
        return FileConstants.readHtmlEmailTemplate("team-invitation");
      case IEmailTemplateType.UnregisteredTeamMemberInvitation:
        return FileConstants.readHtmlEmailTemplate("unregistered-team-invitation-notification");
      case IEmailTemplateType.PasswordChange:
        return FileConstants.readHtmlEmailTemplate("password-changed-notification");
      case IEmailTemplateType.Welcome:
        return FileConstants.readHtmlEmailTemplate("welcome");
      case IEmailTemplateType.OTPVerification:
        return FileConstants.readHtmlEmailTemplate("otp-verfication-code");
      case IEmailTemplateType.ResetPassword:
        return FileConstants.readHtmlEmailTemplate("reset-password");
      case IEmailTemplateType.TaskAssigneeChange:
        return FileConstants.readPugEmailTemplate("task-assignee-change");
      case IEmailTemplateType.DailyDigest:
        return FileConstants.readPugEmailTemplate("daily-digest");
      case IEmailTemplateType.TaskDone:
        return FileConstants.readPugEmailTemplate("task-moved-to-done");
      case IEmailTemplateType.ProjectDailyDigest:
        return FileConstants.readPugEmailTemplate("project-daily-digest");
      case IEmailTemplateType.TaskComment:
        return FileConstants.readPugEmailTemplate("task-comment");
      case IEmailTemplateType.ClientInvitation:
        return FileConstants.readHtmlEmailTemplate("client-invitation");
      default:
        return null;
    }
  }

  static getRelease() {
    if (FileConstants.release === null) {
      FileConstants.release = fs.readFileSync(path.join(__dirname, "../../release"), "utf8").trim();
    }
    return FileConstants.release;
  }
}

export default FileConstants;
