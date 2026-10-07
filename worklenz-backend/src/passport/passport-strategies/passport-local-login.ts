import bcrypt from "bcrypt";
import { Strategy as LocalStrategy } from "passport-local";
import { log_error } from "../../shared/utils";
import db from "../../config/db";
import { Request } from "express";
import { ERROR_KEY, SUCCESS_KEY } from "./passport-constants";
import { logAuditEvent, resolveOrganizationIdForUserId } from "../../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../../shared/audit-log-constants";

/**
 * Logs a login_failed audit event once a request has matched a real user account (wrong
 * password, deactivated access, or an invalid invitation). Spec #32, task 3.1.
 *
 * Deliberately NOT called for "no account found with this email" or missing
 * email/password: there is no real workspace to attach those to, and audit_events.
 * organization_id is NOT NULL by design (append-only compliance evidence needs a tenant,
 * not a guess). preferredTeamId lets an in-progress invitation login attribute the failure
 * to the team being invited into, rather than the user's current active_team.
 */
async function logFailedLogin(
  userId: string,
  actorNameOrEmail: string,
  description: string,
  preferredTeamId?: string | null
): Promise<void> {
  const context = await resolveOrganizationIdForUserId(userId, preferredTeamId);
  if (!context) return;

  logAuditEvent({
    organizationId: context.organizationId,
    teamId: context.teamId,
    actor: { userId, name: actorNameOrEmail },
    eventType: AUDIT_EVENT_TYPE.LOGIN_FAILED.id,
    description,
  });
}

async function handleLogin(req: Request, email: string, password: string, done: any) {
  // Clear any existing flash messages
  (req.session as any).flash = {};

  if (!email || !password) {
    const errorMsg = "Please enter both email and password";
    req.flash(ERROR_KEY, errorMsg);
    return done(null, false);
  }

  try {
    // Normalize email to lowercase for case-insensitive comparison
    const normalizedEmail = email.toLowerCase().trim();
    
    const q = `SELECT id, email, name, google_id, password
               FROM users
               WHERE LOWER(email) = $1
                 AND is_deleted IS FALSE;`;
    const result = await db.query(q, [normalizedEmail]);
    
    const [data] = result.rows;

    if (!data?.password) {
      const errorMsg = "No account found with this email";
      req.flash(ERROR_KEY, errorMsg);
      return done(null, false);
    }

    const passwordMatch = bcrypt.compareSync(password, data.password);
    
    if (passwordMatch) {
      delete data.password;

      const { team_id, team_member_id } = req.body;

      const activeMembershipResult = await db.query(
        `SELECT 1
         FROM team_members
         WHERE user_id = $1
           AND active = TRUE
         LIMIT 1`,
        [data.id],
      );

      if (!activeMembershipResult.rowCount) {
        const errorMsg = "Your access has been deactivated. Please contact your administrator";
        req.flash(ERROR_KEY, errorMsg);
        void logFailedLogin(data.id, data.name || data.email, errorMsg);
        return done(null, false);
      }

      if (team_id && team_member_id) {
        try {
          // Invitation links for already-registered users carry users.id in the
          // `user` param, while links for new users carry team_members.id.
          const invitationContextQuery = `
            SELECT 1
            FROM team_members tm
            INNER JOIN team_member_info_view tmiv ON tmiv.team_member_id = tm.id
            WHERE (tm.id = $1 OR tm.user_id = $1)
              AND tm.team_id = $2
              AND tm.active = TRUE
              AND LOWER(tmiv.email) = $3
            LIMIT 1;
          `;
          const invitationContextResult = await db.query(invitationContextQuery, [
            team_member_id,
            team_id,
            normalizedEmail,
          ]);

          if (!invitationContextResult.rowCount) {
            const errorMsg = "This invitation is no longer active. Please contact your administrator";
            req.flash(ERROR_KEY, errorMsg);
            void logFailedLogin(data.id, data.name || data.email, errorMsg, team_id);
            return done(null, false);
          }

          const setActiveTeamQuery = `SELECT set_active_team($1, $2)`;
          await db.query(setActiveTeamQuery, [data.id, team_id]);
        } catch (error) {
          log_error(error, {
            userId: data.id,
            teamId: team_id,
            teamMemberId: team_member_id,
          });
        }
      }

      const successMsg = "User successfully logged in";
      req.flash(SUCCESS_KEY, successMsg);

      void (async () => {
        const context = await resolveOrganizationIdForUserId(data.id, team_id || null);
        if (!context) return;
        logAuditEvent({
          organizationId: context.organizationId,
          teamId: context.teamId,
          actor: { userId: data.id, name: data.name || data.email },
          eventType: AUDIT_EVENT_TYPE.LOGIN_SUCCESS.id,
        });
      })();

      return done(null, data);
    }
    
    const errorMsg = "Incorrect email or password";
    req.flash(ERROR_KEY, errorMsg);
    void logFailedLogin(data.id, data.name || data.email, errorMsg);
    return done(null, false);
  } catch (error) {
    console.error("Login error:", error);
    log_error(error, req.body);
    return done(error);
  }
}

export default new LocalStrategy({
  usernameField: "email",
  passwordField: "password",
  passReqToCallback: true
}, (req, email, password, done) => void handleLogin(req, email, password, done));