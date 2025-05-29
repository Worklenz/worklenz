import session from "express-session";
import db from "../config/db";
import { isProduction } from "../shared/utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pgSession = require("connect-pg-simple")(session);

export default session({
  name: process.env.SESSION_NAME,
  secret: process.env.SESSION_SECRET || "development-secret-key",
  proxy: false,
  resave: true,
  saveUninitialized: false,
  rolling: true,
  store: new pgSession({
    pool: db.pool,
    tableName: "pg_sessions"
  }),
  cookie: {
    path: "/",
    httpOnly: true,
    secure: false,
    // sameSite: "none",
    // domain: isProduction() ? ".worklenz.com" : undefined,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
});