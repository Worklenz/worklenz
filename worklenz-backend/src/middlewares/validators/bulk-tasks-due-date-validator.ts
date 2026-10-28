import {NextFunction} from "express";
import moment from "moment";
import {t} from "i18next";

import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";

export default function bulkTasksDueDateValidator(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const { end_date, start_date, tasks } = req.body;

  // end_date can be null (to clear due date) or a valid date string
  if (end_date !== null && end_date !== undefined && typeof end_date !== 'string') {
    return res.status(400).send(new ServerResponse(false, null, t("validation.invalidDueDateFormat", {defaultValue: "Invalid due date format"})));
  }

  // start_date can be null (to clear start date) or a valid date string
  if (start_date !== null && start_date !== undefined &&
      (typeof start_date !== 'string' || !isValidStartDate(start_date))) {
    return res.status(400).send(new ServerResponse(false, null, t("validation.invalidStartDateFormat", {defaultValue: "Invalid start date format"})));
  }

  if (!Array.isArray(tasks)) {
    return res.status(400).send(new ServerResponse(false, null, t("validation.tasksMustBeArray", {defaultValue: "Tasks must be an array"})));
  }

  return next();
}

// Only start-date requests require this field; null and empty strings explicitly clear it.
export function bulkTasksStartDateValidator(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  if (req.body.start_date === undefined) {
    return res.status(400).send(new ServerResponse(false, null, t("validation.startDateRequired", {defaultValue: "Start date is required"})));
  }

  return bulkTasksDueDateValidator(req, res, next);
}

const isValidStartDate = (value: string): boolean => {
  if (value === '') return true;

  // Accept calendar dates and ISO timestamps PostgreSQL can cast, excluding week dates,
  // partial dates and out-of-range offsets that Moment's ISO parser also accepts.
  const calendarDate = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-](?:0\d|1[0-5])(?::?[0-5]\d)?)?)?$/;
  return calendarDate.test(value) && moment(value, moment.ISO_8601, true).isValid();
};
