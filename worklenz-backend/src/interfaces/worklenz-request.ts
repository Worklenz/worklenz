import {Request} from "express";
import {IPassportSession} from "./passport-session";

export interface IMemberScope {
  memberIds: string[];
}

export interface IWorkLenzRequest extends Request {
  user?: IPassportSession;
  memberScope?: IMemberScope;
}
