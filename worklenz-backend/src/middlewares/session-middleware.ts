import session from "express-session";
import db from "../config/db";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pgSession = require("connect-pg-simple")(session);

export default session({
  name: process.env.SESSION_NAME,
  secret: process.env.SESSION_SECRET || [], // session secret
  proxy: false,
  resave: false,
  saveUninitialized: true,
  rolling: true,
  store: new pgSession({
    pool: db.pool,
    tableName: "pg_sessions"
  }),
  cookie: {
    path: "/",
    // secure: true,
    // httpOnly: true,
    // sameSite: true,
    // domain: process.env.HOSTNAME,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
});
