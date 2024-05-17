import WorklenzControllerBase from "../controllers/worklenz-controller-base";
import {ServerResponse} from "../models/server-response";
import {DEFAULT_ERROR_MESSAGE} from "../shared/constants";
import {DB_CONSTRAINS} from "../shared/constraints";
import {log_error} from "../shared/utils";
import {Response} from "express";

interface IExceptionHandlerConfig {
  message?: string;
  /** e.g. req.user? "user", req.body? "body" */
  logWithError?: string;
  /** Throws from postgres functions */
  raisedExceptions?: { [x: string]: string };
}

const defaults: IExceptionHandlerConfig = {
  message: DEFAULT_ERROR_MESSAGE,
  raisedExceptions: {},
  logWithError: "user"
};

const isValid = (options: any, key: string) => Object.keys(options[key] || {}).length > 0;
const mergeWithDefaults = (options: any) => ({...defaults, ...(options || {})});

function getConstraint(error: any) {
  return DB_CONSTRAINS[error?.constraint] ?? null;
}

function getConstraintResponse(constraint: string) {
  if (constraint === "[IGNORE]")
    return new ServerResponse(true, null);
  return new ServerResponse(false, null, constraint || DEFAULT_ERROR_MESSAGE);
}

function hasRaisedException(opt: any, keys: any[]): boolean {
  return opt.raisedExceptions?.[keys[0]];
}

function getExceptionMessage(opt: any, keys: any[]) {
  return (opt.raisedExceptions[keys[0]] || DEFAULT_ERROR_MESSAGE).replace(/(\{0\})/g, (keys[1] || ""));
}

function getKeys(error: any) {
  return ((error?.message) || "").split(":");
}

function handleError(error: any, res: Response, opt: any, req: any) {
  const constraint = getConstraint(error);
  if (typeof constraint === "string") {
    const response = getConstraintResponse(constraint);
    return res.status(200).send(response);
  }

  if (isValid(opt, "raisedExceptions")) {
    const keys = getKeys(error);
    if (hasRaisedException(opt, keys)) {
      const msg = getExceptionMessage(opt, keys);
      return res.status(200).send(new ServerResponse(false, null, msg));
    }
  }

  log_error(error, (opt.logWithError && req[opt.logWithError]) || null);
  return res.status(200).send(new ServerResponse(false, null, opt.message));
}

/** HandleExceptions can only be used with an instance of WorklenzControllerBase. */
export default function HandleExceptions(options?: IExceptionHandlerConfig) {
  const opt = mergeWithDefaults(options);
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    if (!(target.prototype instanceof WorklenzControllerBase))
      throw new Error("@HandleExceptions can only be used with an instance of WorklenzControllerBase.");

    const originalMethod = descriptor.value;
    descriptor.value = async (...args: any[]) => {
      try {
        return await originalMethod.apply(target, args);
      } catch (error: any) {
        const [req, res] = args;
        return handleError(error, res, opt, req);
      }
    };
  };
}
