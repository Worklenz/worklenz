import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "../controllers/worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { sanitizeCommentContent, sanitizePlainText, log_error } from "../shared/utils";
import { NotificationsService } from "../services/notifications/notifications.service";
import { sendProjectComment } from "../shared/email-notifications";
import { HTML_TAG_REGEXP, LOG_DESCRIPTIONS, WorklenzColorCodes } from "../shared/constants";
import { getBaseUrl } from "../cron_jobs/helpers";
import safeControllerFunction from "../shared/safe-controller-function";
import type { IWorkLenzRequest } from "../interfaces/worklenz-request";
import type { IWorkLenzResponse } from "../interfaces/worklenz-response";
import idParamValidator from "../middlewares/validators/id-param-validator";
import teamOwnerOrAdminValidator from "../middlewares/validators/team-owner-or-admin-validator";
import { generateProjectKey } from "../utils/generate-project-key";
import {
  createPresignedUrlWithClient,
  getProjectFileStorageKey,
  getPublicUrl,
  uploadBuffer,
} from "../shared/storage";

export {
  db,
  ServerResponse,
  WorklenzControllerBase,
  HandleExceptions,
  sanitizeCommentContent,
  sanitizePlainText,
  log_error,
  NotificationsService,
  sendProjectComment,
  HTML_TAG_REGEXP,
  LOG_DESCRIPTIONS,
  WorklenzColorCodes,
  getBaseUrl,
  safeControllerFunction,
  idParamValidator,
  teamOwnerOrAdminValidator,
  generateProjectKey,
  createPresignedUrlWithClient,
  getProjectFileStorageKey,
  getPublicUrl,
  uploadBuffer,
  IWorkLenzRequest,
  IWorkLenzResponse,
};

export { encodeCsv } from "../shared/csv-utils";
export { default as SqlHelper } from "../shared/sql-helpers";
export { default as ReportingAllTasksController } from "../controllers/reporting/reporting-all-tasks-controller";
export { default as ReportingMembersController } from "../controllers/reporting/reporting-members-controller";
export { default as ReportingAllocationController } from "../controllers/reporting/reporting-allocation-controller";
export { sendEmailEnhanced } from "../shared/email";
export { getOrganizationLogoUrl } from "../shared/email-templates";
