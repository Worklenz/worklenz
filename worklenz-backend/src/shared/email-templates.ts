import {IEmailTemplateType} from "../interfaces/email-template-type";
import {IPassportSession} from "../interfaces/passport-session";
import {sendEmail} from "./email";
import {sanitize} from "./utils";
import FileConstants from "./file-constants";

const FRONTEND_URL = process.env.FRONTEND_URL || "worklenz.com";

export function sendWelcomeEmail(email: string, name: string) {
  let content = FileConstants.getEmailTemplate(IEmailTemplateType.Welcome) as string;
  if (!content) return;

  content = content.replace("[VAR_USER_NAME]", sanitize(name));
  content = content.replace("[VAR_HOSTNAME]", sanitize(FRONTEND_URL));

  sendEmail({
    to: [email],
    subject: "Welcome to Worklenz.",
    html: content
  });
}

export function sendNewSubscriberNotification(subscriberEmail: string) {
  let content = FileConstants.getEmailTemplate(IEmailTemplateType.NewSubscriber) as string;
  if (!content) return;

  content = content.replace("[VAR_EMAIL]", sanitize(subscriberEmail));

  sendEmail({
    subject: "Worklenz - New Subscriber.",
    html: content
  });
}

export function sendJoinTeamInvitation(myName: string, teamName: string, teamId: string, userName: string, toEmail: string, userId: string, projectId?: string) {
  let content = FileConstants.getEmailTemplate(IEmailTemplateType.TeamMemberInvitation) as string;
  if (!content) return;

  content = content.replace("[VAR_USER_NAME]", sanitize(userName));
  content = content.replace("[VAR_TEAM_NAME]", sanitize(teamName));
  content = content.replace("[VAR_HOSTNAME]", sanitize(FRONTEND_URL));
  content = content.replace("[VAR_TEAM_ID]", sanitize(teamId));
  content = content.replace("[VAR_USER_ID]", sanitize(userId));
  content = content.replace("[PROJECT_ID]", projectId ? sanitize(projectId as string) : "");

  sendEmail({
    to: [toEmail],
    subject: `${myName} has invited you to work with ${teamName} in Worklenz`,
    html: content
  });
}

export function sendRegisterAndJoinTeamInvitation(myName: string, userName: string, teamName: string, teamId: string, userId: string, toEmail: string, projectId?: string) {
  let content = FileConstants.getEmailTemplate(IEmailTemplateType.UnregisteredTeamMemberInvitation) as string;
  if (!content) return;

  content = content.replace("[VAR_EMAIL]", sanitize(toEmail));
  content = content.replace("[VAR_USER_ID]", sanitize(userId));
  content = content.replace("[VAR_USER_NAME]", sanitize(userName));
  content = content.replace("[VAR_TEAM_NAME]", sanitize(teamName));
  content = content.replace("[VAR_HOSTNAME]", sanitize(FRONTEND_URL));
  content = content.replace("[VAR_TEAM_ID]", sanitize(teamId));
  content = content.replace("[PROJECT_ID]", projectId ? sanitize(projectId as string) : "");

  sendEmail({
    to: [toEmail],
    subject: `${myName} has invited you to work with ${teamName} in Worklenz`,
    html: content
  });
}

export function sendResetEmail(toEmail: string, user_id: string, hash: string) {
  let content = FileConstants.getEmailTemplate(IEmailTemplateType.ResetPassword) as string;
  if (!content) return;

  content = content.replace("[VAR_HOSTNAME]", sanitize(FRONTEND_URL));
  content = content.replace("[VAR_USER_ID]", sanitize(user_id));
  content = content.replace("[VAR_HASH]", hash);

  sendEmail({
    to: [toEmail],
    subject: "Reset your password on Worklenz.",
    html: content
  });
}


export function sendResetSuccessEmail(toEmail: string) {
  const content = FileConstants.getEmailTemplate(IEmailTemplateType.PasswordChange) as string;
  if (!content) return;

  sendEmail({
    to: [toEmail],
    subject: "Your password was reset.",
    html: content
  });
}

// * This implementation should be improved
export function sendInvitationEmail(isNewMember: boolean, user: IPassportSession, userNameOrId: string, email: string, userId: string, userName?: string, projectId?: string) {
  if (isNewMember) {
    // userNameOrId = userName
    sendJoinTeamInvitation(user?.name as string, user?.team_name as string, user.team_id as string, userNameOrId, email, userId, projectId);
  } else {
    // userNameOrId = userId
    sendRegisterAndJoinTeamInvitation(user?.name as string, userName as string, user?.team_name as string, user.team_id as string, userNameOrId, email, projectId);
  }
}
