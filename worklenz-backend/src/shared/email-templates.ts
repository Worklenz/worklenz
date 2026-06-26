import {IEmailTemplateType} from "../interfaces/email-template-type";
import {IPassportSession} from "../interfaces/passport-session";
import {sendEmail} from "./email";
import {sanitize, sanitizePlainText} from "./utils";
import FileConstants from "./file-constants";
import db from "../config/db";

// Ensure FRONTEND_URL is always an absolute URL with a scheme.
// Without https://, email clients (e.g. Outlook Safe Links) strip the <a> tag.
const _rawFrontendUrl = process.env.FRONTEND_URL || "worklenz.com";
const FRONTEND_URL = (_rawFrontendUrl.startsWith("http") ? _rawFrontendUrl : `https://${_rawFrontendUrl}`).replace(/\/+$/, "");

const DEFAULT_LOGO_URL = "https://s3.us-west-2.amazonaws.com/worklenz.com/email-templates-assets/worklenz-light-mode.png";

/**
 * Validates that a URL is a safe http/https URL for use in email templates.
 * Returns the URL as-is if valid, otherwise returns the default logo URL.
 */
function safeLogoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return url;
    }
  } catch {
    // invalid URL
  }
  return DEFAULT_LOGO_URL;
}

/**
 * Fetches the organization branding logo URL for a given team.
 * Falls back to the default Worklenz logo if no custom logo is set.
 */
async function getOrganizationLogoUrl(teamId: string): Promise<string> {
  try {
    const q = `
      SELECT o.logo_url
      FROM organizations o
      INNER JOIN teams t ON (t.user_id = o.user_id OR t.organization_id = o.id)
      WHERE t.id = $1
      LIMIT 1
    `;
    const result = await db.query(q, [teamId]);
    const logoUrl = result.rows[0]?.logo_url;
    return logoUrl ? safeLogoUrl(logoUrl) : DEFAULT_LOGO_URL;
  } catch {
    return DEFAULT_LOGO_URL;
  }
}

export function sendWelcomeEmail(email: string, name: string) {
  let content = FileConstants.getEmailTemplate(IEmailTemplateType.Welcome) as string;
  if (!content) return;

  // Use sanitizePlainText for user names to prevent HTML injection
  // Names should never contain HTML markup
  content = content.replace("[VAR_USER_NAME]", sanitizePlainText(name));
  content = content.replace("[VAR_HOSTNAME]", FRONTEND_URL);

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

export async function sendJoinTeamInvitation(myName: string, teamName: string, teamId: string, userName: string, toEmail: string, userId: string, projectId?: string) {
  let content = FileConstants.getEmailTemplate(IEmailTemplateType.TeamMemberInvitation) as string;
  if (!content) return;

  const logoUrl = await getOrganizationLogoUrl(teamId);

  // logoUrl is already validated as a safe http/https URL by safeLogoUrl()
  // Use sanitizePlainText for user/team names to prevent HTML injection
  content = content.replaceAll("[VAR_LOGO_URL]", logoUrl);
  content = content.replaceAll("[VAR_USER_NAME]", sanitizePlainText(userName));
  content = content.replaceAll("[VAR_TEAM_NAME]", sanitizePlainText(teamName));
  content = content.replaceAll("[VAR_HOSTNAME]", sanitize(FRONTEND_URL));
  content = content.replaceAll("[VAR_TEAM_ID]", sanitize(teamId));
  content = content.replaceAll("[VAR_USER_ID]", sanitize(userId));
  content = content.replaceAll("[PROJECT_ID]", projectId ? sanitize(projectId as string) : "");

  sendEmail({
    to: [toEmail],
    subject: `${sanitizePlainText(myName)} has invited you to work with ${sanitizePlainText(teamName)} in Worklenz`,
    html: content
  });
}

export async function sendRegisterAndJoinTeamInvitation(myName: string, userName: string, teamName: string, teamId: string, userId: string, toEmail: string, projectId?: string) {
  let content = FileConstants.getEmailTemplate(IEmailTemplateType.UnregisteredTeamMemberInvitation) as string;
  if (!content) return;

  const logoUrl = await getOrganizationLogoUrl(teamId);

  // logoUrl is already validated as a safe http/https URL by safeLogoUrl()
  // Use sanitizePlainText for user/team names to prevent HTML injection
  // Email addresses are validated elsewhere, no need to sanitize in HTML context
  content = content.replaceAll("[VAR_LOGO_URL]", logoUrl);
  content = content.replaceAll("[VAR_EMAIL]", toEmail);
  content = content.replaceAll("[VAR_USER_ID]", userId);
  content = content.replaceAll("[VAR_USER_NAME]", sanitizePlainText(userName));
  content = content.replaceAll("[VAR_TEAM_NAME]", sanitizePlainText(teamName));
  content = content.replaceAll("[VAR_HOSTNAME]", FRONTEND_URL);
  content = content.replaceAll("[VAR_TEAM_ID]", teamId);
  content = content.replaceAll("[PROJECT_ID]", projectId || "");

  sendEmail({
    to: [toEmail],
    subject: `${sanitizePlainText(myName)} has invited you to work with ${sanitizePlainText(teamName)} in Worklenz`,
    html: content
  });
}

export async function sendResetEmail(toEmail: string, user_id: string, hash: string) {
  let content = FileConstants.getEmailTemplate(IEmailTemplateType.ResetPassword) as string;
  if (!content) return;

  // FRONTEND_URL is a trusted environment variable, no need to sanitize
  // user_id is base64 encoded (safe), hash is a hex token (safe)
  content = content.replace("[VAR_HOSTNAME]", FRONTEND_URL);
  content = content.replace("[VAR_USER_ID]", user_id);
  content = content.replace("[VAR_HASH]", hash);

  await sendEmail({
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

export async function sendClientPortalResetEmail(toEmail: string, user_id: string, hash: string) {
  let content = FileConstants.getEmailTemplate(IEmailTemplateType.ResetPasswordClientPortal) as string;
  if (!content) return;

  const CLIENT_PORTAL_HOSTNAME = process.env.CLIENT_PORTAL_HOSTNAME
    ? `https://${process.env.CLIENT_PORTAL_HOSTNAME}`
    : "http://localhost:5174";

  // CLIENT_PORTAL_HOSTNAME is a trusted environment variable, no need to sanitize
  // user_id is base64 encoded (safe), hash is bcrypt hash (safe)
  content = content.replace("[VAR_HOSTNAME]", CLIENT_PORTAL_HOSTNAME);
  content = content.replace("[VAR_USER_ID]", user_id);
  content = content.replace("[VAR_HASH]", hash);

  // For development: Log the reset password link to console
  const resetLink = `${CLIENT_PORTAL_HOSTNAME}/auth/reset-password?user=${user_id}&hash=${hash}`;
  console.log('\n========================================');
  console.log('🔐 CLIENT PORTAL PASSWORD RESET EMAIL');
  console.log('========================================');
  console.log(`To: ${toEmail}`);
  console.log(`Reset Link: ${resetLink}`);
  console.log('========================================\n');

  await sendEmail({
    to: [toEmail],
    subject: "Reset your Client Portal password.",
    html: content
  });
}

// * This implementation should be improved
export async function sendInvitationEmail(isNewMember: boolean, user: IPassportSession, userNameOrId: string, email: string, userId: string, userName?: string, projectId?: string) {
  if (isNewMember) {
    // userNameOrId = userName
    await sendJoinTeamInvitation(user?.name as string, user?.team_name as string, user.team_id as string, userNameOrId, email, userId, projectId);
  } else {
    // userNameOrId = userId
    await sendRegisterAndJoinTeamInvitation(user?.name as string, userName as string, user?.team_name as string, user.team_id as string, userNameOrId, email, projectId);
  }
}
