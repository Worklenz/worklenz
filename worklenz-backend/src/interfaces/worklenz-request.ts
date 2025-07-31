import {Request} from "express";
import {IPassportSession} from "./passport-session";

export interface IWorkLenzRequest extends Request {
  user?: IPassportSession;
}
