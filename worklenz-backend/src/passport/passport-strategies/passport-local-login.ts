import bcrypt from "bcrypt";
import { Strategy as LocalStrategy } from "passport-local";
import { log_error } from "../../shared/utils";
import db from "../../config/db";
import { Request } from "express";
import { ERROR_KEY, SUCCESS_KEY } from "./passport-constants";

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
    
    const q = `SELECT id, email, google_id, password
               FROM users
               WHERE LOWER(email) = $1
                 AND google_id IS NULL
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

      if (team_id && team_member_id) {
        try {
          const invitationContextQuery = `
            SELECT 1
            FROM team_members tm
            INNER JOIN team_member_info_view tmiv ON tmiv.team_member_id = tm.id
            WHERE tm.id = $1
              AND tm.team_id = $2
              AND LOWER(tmiv.email) = $3
            LIMIT 1;
          `;
          const invitationContextResult = await db.query(invitationContextQuery, [
            team_member_id,
            team_id,
            normalizedEmail,
          ]);

          if (invitationContextResult.rowCount && invitationContextResult.rowCount > 0) {
            const setActiveTeamQuery = `SELECT set_active_team($1, $2)`;
            await db.query(setActiveTeamQuery, [data.id, team_id]);
          }
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
      return done(null, data);
    }
    
    const errorMsg = "Incorrect email or password";
    req.flash(ERROR_KEY, errorMsg);
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