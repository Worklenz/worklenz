import axios from "axios";
import db from "../config/db";
import i18next from "../config/i18n";
import { I18nHelper } from "../shared/i18n-helper";

export interface SecurityRejection {
  code: string;
  status: number;
  message: string;
}

/** Only explicit database policy errors are safe to expose to callers. */
export const getSecurityRejection = (error: unknown): Omit<SecurityRejection, "message"> | null => {
  if (!(error instanceof Error)) return null;
  switch (error.message) {
    case "ERROR_NEW_TRIAL_INVITATION_LIMIT_EXCEEDED":
    case "ERROR_SECURITY_INVITATION_LIMIT": return { code: "invitationLimit", status: 429 };
    case "ERROR_SECURITY_INVITATIONS_PAUSED": return { code: "invitationsPaused", status: 403 };
    case "ERROR_BLOCKED_TASK_CONTENT_URL":
    case "ERROR_SECURITY_BLOCKED_TASK_HOST": return { code: "blockedTaskHost", status: 400 };
    default: return null;
  }
};

const messages: Record<string, string> = {
  invitationLimit: "This workspace has reached its invitation safety limit. Please try again later.",
  invitationsPaused: "Invitations are temporarily paused. Please contact your administrator.",
  blockedTaskHost: "This task contains a blocked link. Please remove it and try again.",
};

/** Persist outside the rejected statement's transaction; no email, content, or credentials. */
export const recordSecurityEvent = async (code: string, teamId?: string): Promise<void> => {
  try {
    const result = await db.query(
      `INSERT INTO security_events (team_id, event_type) VALUES ($1, $2)
       ON CONFLICT (team_id, event_type, bucket_start) DO UPDATE
       SET attempt_count = security_events.attempt_count + 1
       RETURNING id, attempt_count;`,
      [teamId || null, code],
    );
    const event = result.rows[0] as { id: string; attempt_count: number } | undefined;
    if (!event || event.attempt_count !== 1) return;
    console.warn(JSON.stringify({ event: "security_policy_rejected", code, teamId: teamId || null, id: event.id }));

    const endpoint = process.env.SECURITY_ALERT_WEBHOOK_URL;
    if (!endpoint) return;
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) {
      console.error("Security alert webhook must use HTTPS without embedded credentials.");
      return;
    }
    await axios.post(endpoint, { id: event.id, code, teamId: teamId || null }, {
      timeout: 3000,
      maxRedirects: 0,
      maxContentLength: 65536,
    });
    await db.query("UPDATE security_events SET delivered_at = CURRENT_TIMESTAMP WHERE id = $1", [event.id]);
  } catch {
    // Avoid the generic logger: it may forward errors (including webhook secrets) to Slack.
    console.error("Unable to persist or deliver a security event. Check local database/webhook configuration.");
  }
};

export const handleSecurityPolicyError = async (
  error: unknown, teamId?: string, userId?: string,
): Promise<SecurityRejection | null> => {
  const rejection = getSecurityRejection(error);
  if (!rejection) return null;
  await recordSecurityEvent(rejection.code, teamId);
  const language = await I18nHelper.getUserLanguage(userId);
  return {
    ...rejection,
    message: i18next.t(`notifications:security.${rejection.code}`, {
      lng: language,
      defaultValue: messages[rejection.code],
    }),
  };
};

/** Sender-side quota also covers project invitations to existing team members. */
export const reserveInvitationEmail = async (teamId?: string): Promise<void> => {
  try {
    await db.query("SELECT reserve_security_invitation($1::UUID, 'email');", [teamId || null]);
  } catch (error) {
    const rejection = getSecurityRejection(error);
    if (!rejection) throw error;
    await recordSecurityEvent(rejection.code, teamId);
    // Callers often log asynchronously. Never attach recipient data or webhook config.
    throw new Error(error instanceof Error ? error.message : "Invitation rejected");
  }
};
