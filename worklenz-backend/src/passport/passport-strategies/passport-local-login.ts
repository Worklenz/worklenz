import bcrypt from "bcrypt";
import {Strategy as LocalStrategy} from "passport-local";

import {log_error} from "../../shared/utils";
import db from "../../config/db";
import {Request} from "express";

async function handleLogin(req: Request, email: string, password: string, done: any) {
  (req.session as any).flash = {};

  if (!email || !password)
    return done(null, false, {message: "Invalid credentials."});

  try {
    // select the user from the database based on the username
    const q = `SELECT id, email, google_id, password
               FROM users
               WHERE email = $1
                 AND google_id IS NULL;`;
    const result = await db.query(q, [email]);
    const [data] = result.rows;

    // Check user existence
    if (!data?.password)
      return done(null, false, {message: "Invalid credentials."});

    // Compare the password & email
    if (bcrypt.compareSync(password, data.password) && email === data.email) {
      delete data.password;

      req.logout(() => true);
      return done(false, data, {message: "User successfully logged in"});
    }

    return done(null, false, {message: "Invalid credentials."});
  } catch (error) {
    log_error(error, req.body);
    return done(error);
  }
}

export default new LocalStrategy({
  usernameField: "email", // = email
  passwordField: "password",
  passReqToCallback: true
}, (req, email, password, done) => void handleLogin(req, email, password, done));
