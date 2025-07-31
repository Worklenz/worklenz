import bcrypt from "bcrypt";
import {Strategy as LocalStrategy} from "passport-local";

import {DEFAULT_ERROR_MESSAGE} from "../../shared/constants";
import {sendWelcomeEmail} from "../../shared/email-templates";
import {log_error} from "../../shared/utils";

import db from "../../config/db";
import {Request} from "express";
import {ERROR_KEY, SUCCESS_KEY} from "./passport-constants";
import { SpamDetector } from "../../utils/spam-detector";
import loggerModule from "../../utils/logger";

const { logger } = loggerModule;

async function isGoogleAccountFound(email: string) {
  const q = `
    SELECT 1
    FROM users
    WHERE email = $1
      AND google_id IS NOT NULL;
  `;
  const result = await db.query(q, [email]);
  return !!result.rowCount;
}

async function registerUser(password: string, team_id: string, name: string, team_name: string, email: string, timezone: string, team_member_id: string) {
  const salt = bcrypt.genSaltSync(10);
  const encryptedPassword = bcrypt.hashSync(password, salt);

  const teamId = team_id || null;
  const q = "SELECT register_user($1) AS user;";

  const body = {
    name,
    team_name,
    email,
    password: encryptedPassword,
    timezone,
    invited_team_id: teamId,
    team_member_id,
  };

  const result = await db.query(q, [JSON.stringify(body)]);
  const [data] = result.rows;
  return data.user;
}

async function handleSignUp(req: Request, email: string, password: string, done: any) {
  (req.session as any).flash = {};
  // team = Invited team_id if req.body.from_invitation is true
  const {name, team_name, team_member_id, team_id, timezone} = req.body;

  if (!team_name) return done(null, null, req.flash(ERROR_KEY, "Team name is required"));

  // Check for spam in team name - Flag suspicious but allow signup
  const teamNameSpamCheck = SpamDetector.detectSpam(team_name);
  if (teamNameSpamCheck.score > 0 || teamNameSpamCheck.reasons.length > 0) {
    logger.warn('⚠️ SUSPICIOUS SIGNUP - TEAM NAME', {
      email,
      team_name,
      user_name: name,
      spam_score: teamNameSpamCheck.score,
      reasons: teamNameSpamCheck.reasons,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
      alert_type: 'suspicious_signup_flagged'
    });
    // Continue with signup but flag for review
  }

  // Check for spam in user name - Flag suspicious but allow signup
  const userNameSpamCheck = SpamDetector.detectSpam(name);
  if (userNameSpamCheck.score > 0 || userNameSpamCheck.reasons.length > 0) {
    logger.warn('⚠️ SUSPICIOUS SIGNUP - USER NAME', {
      email,
      team_name,
      user_name: name,
      spam_score: userNameSpamCheck.score,
      reasons: userNameSpamCheck.reasons,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
      alert_type: 'suspicious_signup_flagged'
    });
    // Continue with signup but flag for review
  }

  // Only block EXTREMELY high-risk content (known spam domains, obvious scams)
  if (SpamDetector.isHighRiskContent(team_name) || SpamDetector.isHighRiskContent(name)) {
    // Check if it's REALLY obvious spam (very high scores)
    const isObviousSpam = teamNameSpamCheck.score > 80 || userNameSpamCheck.score > 80 || 
                         /gclnk\.com|bit\.ly\/scam|win.*\$\d+.*crypto/i.test(team_name + ' ' + name);
    
    if (isObviousSpam) {
      logger.error('🛑 SIGNUP BLOCKED - OBVIOUS SPAM', {
        email,
        team_name,
        user_name: name,
        team_spam_score: teamNameSpamCheck.score,
        user_spam_score: userNameSpamCheck.score,
        ip_address: req.ip,
        timestamp: new Date().toISOString(),
        alert_type: 'obvious_spam_blocked'
      });
      return done(null, null, req.flash(ERROR_KEY, "Registration temporarily unavailable. Please contact support if you need immediate access."));
    } else {
      // High-risk but not obviously spam - flag and allow
      logger.error('🔥 HIGH RISK SIGNUP - FLAGGED', {
        email,
        team_name,
        user_name: name,
        team_spam_score: teamNameSpamCheck.score,
        user_spam_score: userNameSpamCheck.score,
        ip_address: req.ip,
        timestamp: new Date().toISOString(),
        alert_type: 'high_risk_signup_flagged'
      });
      // Continue with signup but flag for immediate review
    }
  }

  const googleAccountFound = await isGoogleAccountFound(email);
  if (googleAccountFound)
    return done(null, null, req.flash(ERROR_KEY, `${req.body.email} is already linked with a Google account.`));

  try {
    const user = await registerUser(password, team_id, name, team_name, email, timezone, team_member_id);
    
    // If signup was suspicious, flag the team for review after creation
    const totalSuspicionScore = (teamNameSpamCheck.score || 0) + (userNameSpamCheck.score || 0);
    if (totalSuspicionScore > 0) {
      // Flag team for admin review (but don't block user)
      const flagQuery = `
        INSERT INTO spam_logs (team_id, user_id, content_type, original_content, spam_score, spam_reasons, action_taken, ip_address)
        VALUES (
          (SELECT team_id FROM users WHERE id = $1), 
          $1, 
          'signup_review', 
          $2, 
          $3, 
          $4, 
          'flagged_for_review',
          $5
        )
      `;
      
      try {
        await db.query(flagQuery, [
          user.id,
          `Team: ${team_name} | User: ${name}`,
          totalSuspicionScore,
          JSON.stringify([...teamNameSpamCheck.reasons, ...userNameSpamCheck.reasons]),
          req.ip
        ]);
      } catch (flagError) {
        // Don't fail signup if flagging fails
        logger.warn('Failed to flag suspicious signup for review', { error: flagError, user_id: user.id });
      }
    }
    
    sendWelcomeEmail(email, name);
    return done(null, user, req.flash(SUCCESS_KEY, "Registration successful. Please check your email for verification."));
  } catch (error: any) {
    const message = (error?.message) || "";

    if (message === "ERROR_INVALID_JOINING_EMAIL") {
      return done(null, null, req.flash(ERROR_KEY, `No invitations found for email ${req.body.email}.`));
    }

    // if error.message is "email already exists" then it should have the email address in the error message after ":".
    if (message.includes("EMAIL_EXISTS_ERROR") || error.constraint === "users_google_id_uindex") {
      const [, value] = error.message.split(":");
      return done(null, null, req.flash(ERROR_KEY, `Worklenz account already exists for email ${value}.`));
    }

    if (message.includes("TEAM_NAME_EXISTS_ERROR")) {
      const [, value] = error.message.split(":");
      return done(null, null, req.flash(ERROR_KEY, `Team name "${value}" already exists. Please choose a different team name.`));
    }

    // The Team name is already taken.
    if (error.constraint === "teams_url_uindex" || error.constraint === "teams_name_uindex") {
      return done(null, null, req.flash(ERROR_KEY, `Team name "${team_name}" is already taken. Please choose a different team name.`));
    }

    log_error(error, req.body);
    return done(null, null, req.flash(ERROR_KEY, DEFAULT_ERROR_MESSAGE));
  }
}

export default new LocalStrategy({
  usernameField: "email",
  passwordField: "password",
  passReqToCallback: true
}, (req, email, password, done) => void handleSignUp(req, email, password, done));
