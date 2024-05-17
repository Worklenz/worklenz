import WorklenzControllerBase from "./worklenz-controller-base";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {NextFunction} from "express";
import FileConstants from "../shared/file-constants";
import {isInternalServer, isProduction, log_error} from "../shared/utils";
import db from "../config/db";
import createHttpError from "http-errors";

export default class IndexController extends WorklenzControllerBase {
  public static use(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) {
    try {
      const url = `https://${req.hostname}${req.url}`;
      res.locals.release = FileConstants.getRelease();
      res.locals.user = req.user;
      res.locals.url = url;
      res.locals.env = process.env.NODE_ENV;
      res.locals.isInternalServer = isInternalServer;
      res.locals.isProduction = isProduction;
    } catch (error) {
      console.error(error);
    }
    next();
  }

  public static async index(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const q = `SELECT free_tier_storage, team_member_limit, projects_limit, trial_duration FROM licensing_settings;`;
    const result = await db.query(q, []);
    const [settings] = result.rows;
    res.render("index", {settings});
  }

  public static pricing(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    res.render("pricing");
  }

  public static privacyPolicy(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    res.render("privacy-policy");
  }

  public static termsOfUse(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    res.render("terms-of-use");
  }

  public static admin(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    res.render("admin");
  }

  public static auth(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    if (req.isAuthenticated())
      return res.redirect("/worklenz");
    return res.render("admin");
  }

  public static worklenz(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    if (req.isAuthenticated())
      return res.render("admin");

    if (req.user && !req.user.is_member)
      return res.redirect("/teams");

    return res.redirect("/auth");
  }

  public static redirectToLogin(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    res.redirect("/auth/login");
  }

  public static async signup(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): Promise<void> {
    try {
      const teamMemberId = req.query.user as string;
      const q = `SELECT set_active_team_by_member_id($1);`;
      await db.query(q, [teamMemberId || null]);
    } catch (error) {
      log_error(error, req.query);
      return next(createHttpError(500));
    }

    if (req.isAuthenticated())
      return res.redirect("/worklenz");

    return res.render("admin");
  }

  public static async login(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) {
    // Set active team to invited team
    try {
      const teamId = req.query.team as string; // invited team id
      const userId = req.query.user as string; // invited user's id
      const q = `SELECT set_active_team($1, $2);`;
      await db.query(q, [userId || null, teamId || null]);
    } catch (error) {
      log_error(error, req.query);
      return next(createHttpError(500));
    }

    if (req.isAuthenticated())
      return res.redirect("/worklenz");

    return res.render("admin");
  }
}
