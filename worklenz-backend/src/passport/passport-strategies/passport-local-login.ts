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
      
      // Handle invitation parameters if present
      const { team_id, team_member_id, project_id } = req.body;
      
      if (team_id) {
        try {
          // Set the invited team as active for the user
          const setActiveTeamQuery = `SELECT set_active_team($1, $2)`;
          await db.query(setActiveTeamQuery, [data.id, team_id]);
          console.log(`[Login] Set active team ${team_id} for user ${data.id}`);
          
          // Store invitation info in session for redirect after login
          (req.session as any).invitationRedirect = {
            teamId: team_id,
            teamMemberId: team_member_id,
            projectId: project_id
          };
        } catch (error) {
          console.error('[Login] Failed to set active team:', error);
          log_error(error, { userId: data.id, teamId: team_id });
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