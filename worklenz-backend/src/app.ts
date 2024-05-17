import createError from "http-errors";
import express, {NextFunction, Request, Response} from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import helmet from "helmet";
import compression from "compression";
import passport from "passport";
import csurf from "csurf";
import rateLimit from "express-rate-limit";
import cors from "cors";
import uglify from "uglify-js";
import flash from "connect-flash";
import hpp from "hpp";

import passportConfig from "./passport";
import indexRouter from "./routes/index";
import apiRouter from "./routes/apis";
import authRouter from "./routes/auth";
import emailTemplatesRouter from "./routes/email-templates";

import public_router from "./routes/public";
import {isInternalServer, isProduction} from "./shared/utils";
import sessionMiddleware from "./middlewares/session-middleware";
import {send_to_slack} from "./shared/slack";
import {CSP_POLICIES} from "./shared/csp";
import safeControllerFunction from "./shared/safe-controller-function";
import AwsSesController from "./controllers/aws-ses-controller";

const app = express();

app.use(compression());
app.use(helmet({crossOriginResourcePolicy: false, crossOriginEmbedderPolicy: false}));

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.removeHeader("server");
  next();
});

function isLoggedIn(req: Request, _res: Response, next: NextFunction) {
  return req.user ? next() : next(createError(401));
}

passportConfig(passport);

// eslint-disable-next-line @typescript-eslint/no-var-requires
require("pug").filters = {
  /**
   * ```pug
   * script
   *   :minify_js
   *     // JavaScript Syntax
   * ```
   * @param {String} text
   * @param {Object} options
   */
  minify_js(text: string) {
    if (!text) return;
    // return text;
    return uglify.minify({"script.js": text}).code;
  }
};

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json({limit: "50mb"}));
app.use(express.urlencoded({extended: false, limit: "50mb"}));
// Prevent HTTP Parameter Pollution
app.use(hpp());
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use(cors({
  origin: [`https://${process.env.HOSTNAME}`],
  methods: "GET,PUT,POST,DELETE",
  preflightContinue: false,
  credentials: true
}));

app.post("/-/csp", (req: express.Request, res: express.Response) => {
  send_to_slack({
    type: "⚠️ CSP Report",
    body: req.body
  });
  res.sendStatus(200);
});

app.post("/webhook/emails/bounce", safeControllerFunction(AwsSesController.handleBounceResponse));
app.post("/webhook/emails/complaints", safeControllerFunction(AwsSesController.handleComplaintResponse));
app.post("/webhook/emails/reply", safeControllerFunction(AwsSesController.handleReplies));

app.use(flash());
app.use(csurf({cookie: true}));

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Security-Policy", CSP_POLICIES);
  const token = req.csrfToken();
  res.cookie("XSRF-TOKEN", token);
  res.locals.csrf = token;
  next();
});

if (isProduction()) {
  app.get("*.js", (req, res, next) => {
    if (req.header("Accept-Encoding")?.includes("br")) {
      req.url = `${req.url}.br`;
      res.set("Content-Encoding", "br");
      res.set("Content-Type", "application/javascript; charset=UTF-8");
    } else if (req.header("Accept-Encoding")?.includes("gzip")) {
      req.url = `${req.url}.gz`;
      res.set("Content-Encoding", "gzip");
      res.set("Content-Type", "application/javascript; charset=UTF-8");
    }
    next();
  });
}

app.use(express.static(path.join(__dirname, "public")));
app.set("trust proxy", 1);
app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1500, // Limit each IP to 2000 requests per `window` (here, per 15 minutes)
  standardHeaders: false, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use((req, res, next) => {
  const {send} = res;
  res.send = function (obj) {
    if (req.headers.accept?.includes("application/json"))
      return send.call(this, `)]}',\n${JSON.stringify(obj)}`);
    return send.call(this, obj);
  };
  next();
});

app.use("/secure", authRouter);
app.use("/public", public_router);
app.use("/api/v1", isLoggedIn, apiRouter);
app.use("/", indexRouter);

if (isInternalServer())
  app.use("/email-templates", emailTemplatesRouter);


// catch 404 and forward to error handler
app.use((req: Request, res: Response) => {
  res.locals.error_title = "404 Not Found.";
  res.locals.error_message = `The requested URL ${req.url} was not found on this server.`;
  res.locals.error_image = "/assets/images/404.webp";
  res.status(400);
  res.render("error");
});

// error handler
app.use((err: { message: string; status: number; }, _req: Request, res: Response) => {
  // set locals, only providing error in development
  res.locals.error_title = "500 Internal Server Error.";
  res.locals.error_message = "Oops, something went wrong.";
  res.locals.error_message2 = "Try to refresh this page or feel free to contact us if the problem persists.";
  res.locals.error_image = "/assets/images/500.png";

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

export default app;
