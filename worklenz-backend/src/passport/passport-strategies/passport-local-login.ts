import bcrypt from "bcrypt";
import { Strategy as LocalStrategy } from "passport-local";
import { log_error } from "../../shared/utils";
import db from "../../config/db";
import { Request } from "express";

async function handleLogin(req: Request, email: string, password: string, done: any) {
  if (!email || !password) {
    return done(null, false, { message: "Please enter both email and password" });
  }

  try {
    const q = `SELECT id, email, google_id, password
               FROM users
               WHERE email = $1
                 AND google_id IS NULL
                 AND is_deleted IS FALSE;`;
    const result = await db.query(q, [email]);
    
    const [data] = result.rows;

    if (!data?.password) {
      return done(null, false, { message: "No account found with this email" });
    }

    const passwordMatch = bcrypt.compareSync(password, data.password);
    
    if (passwordMatch && email === data.email) {
      delete data.password;
      return done(null, data, {message: "User successfully logged in"});
    }
    return done(null, false, { message: "Incorrect email or password" });
  } catch (error) {
    log_error(error, req.body);
    return done(error);
  }
}

export default new LocalStrategy({
  usernameField: "email",
  passwordField: "password",
  passReqToCallback: true
}, (req, email, password, done) => void handleLogin(req, email, password, done));