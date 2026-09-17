import { Request, Express } from "express";
import { IPassportSession } from "./passport-session";

export interface IMemberScope {
  memberIds: string[];
}
export interface IProjectFileMeta {
  extension: string;
  cleanFileName: string;
}

export interface IWorkLenzRequest extends Request {
    rawBody?: string;
  user?: IPassportSession;
  memberScope?: IMemberScope;
  file?: Express.Multer.File;
  projectFileMeta?: IProjectFileMeta;
}
