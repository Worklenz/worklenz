import db from "../../config/db";
import { IActivityLog, IActivityLogAttributeTypes, IActivityLogChangeType } from "./interfaces";
import { log_error } from "../../shared/utils";
import moment from "moment";
import { getLoggedInUserIdFromSocket } from "../../socket.io/util";

export async function insertToActivityLogs(activityLog: IActivityLog) {
  try {
    const {
      task_id,
      attribute_type,
      user_id,
      log_type,
      old_value,
      new_value,
      next_string
    } = activityLog;

    const q = `
      INSERT INTO task_activity_logs (task_id, team_id, attribute_type, user_id, log_type, old_value, new_value, next_string, project_id)
      VALUES (
        $1,
        (SELECT team_id FROM projects WHERE id = (SELECT project_id FROM tasks WHERE tasks.id = $1)),
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        (SELECT project_id FROM tasks WHERE tasks.id = $1));
    `;
    await db.query(q, [task_id, attribute_type, user_id, log_type, old_value, new_value, next_string]);
  } catch (e) {
    log_error(e);
  }
}

export async function getTaskDetails(task_id: string, column: string) {
  try {
    const q = `SELECT ${column}
               FROM tasks
               WHERE id = $1;`;
    const result = await db.query(q, [task_id]);
    const [data] = result.rows;
    return data;
  } catch (e) {
    log_error(e);
  }
}

export async function getTaskPhaseDetails(task_id: string) {
  try {
    const q = `SELECT phase_id FROM task_phase WHERE task_id = $1`;
    const result = await db.query(q, [task_id]);
    const [data] = result.rows;
    return data ? data : { phase_id: null };
  } catch (e) {
    log_error(e);
  }
}

export async function logStartDateChange(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;

  if (!task_id || !activityLog.socket) return;
  if (!(moment(old_value).isSame(moment(new_value), "date"))) {
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.log_type = IActivityLogChangeType.UPDATE;
    activityLog.attribute_type = IActivityLogAttributeTypes.START_DATE;
    activityLog.new_value = activityLog.new_value ? moment(activityLog.new_value).format("YYYY-MM-DD") : null;
    activityLog.old_value = activityLog.old_value ? moment(activityLog.old_value).format("YYYY-MM-DD") : null;

    insertToActivityLogs(activityLog);
  }
}

export async function logEndDateChange(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;

  if (!task_id || !activityLog.socket) return;
  if (!(moment(old_value).isSame(moment(new_value), "date"))) {
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.log_type = IActivityLogChangeType.UPDATE;
    activityLog.attribute_type = IActivityLogAttributeTypes.END_DATE;
    activityLog.new_value = activityLog.new_value ? moment(activityLog.new_value).format("YYYY-MM-DD") : null;
    activityLog.old_value = activityLog.old_value ? moment(activityLog.old_value).format("YYYY-MM-DD") : null;

    insertToActivityLogs(activityLog);
  }
}

export async function logNameChange(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;

  if (!task_id || !activityLog.socket) return;
  if (old_value !== new_value) {
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.log_type = IActivityLogChangeType.UPDATE;
    activityLog.attribute_type = IActivityLogAttributeTypes.NAME;

    insertToActivityLogs(activityLog);
  }
}

export async function logTotalMinutes(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;

  if (!task_id || !activityLog.socket) return;
  if (old_value !== new_value) {
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.log_type = IActivityLogChangeType.UPDATE;
    activityLog.attribute_type = IActivityLogAttributeTypes.ESTIMATION;

    insertToActivityLogs(activityLog);
  }
}

export async function logMemberAssignment(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;

  const q = `SELECT user_id, name
             FROM team_member_info_view
             WHERE team_member_id = $1;`;
  const result = await db.query(q, [new_value]);
  const [data] = result.rows;

  if (!task_id || !activityLog.socket) return;
  if (old_value !== new_value) {
    activityLog.new_value = data.user_id || null;
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.log_type = activityLog.assign_type === "ASSIGN" ? IActivityLogChangeType.ASSIGN : IActivityLogChangeType.UNASSIGN;
    activityLog.attribute_type = IActivityLogAttributeTypes.ASSIGNEES;
    activityLog.next_string = data.name || null;

    insertToActivityLogs(activityLog);
  }
}

export async function logLabelsUpdate(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;

  const q = `SELECT EXISTS(SELECT task_id FROM task_labels WHERE task_id = $1 AND label_id = $2)`;
  const result = await db.query(q, [task_id, new_value]);
  const [data] = result.rows;
  activityLog.log_type = data.exists ? IActivityLogChangeType.CREATE : IActivityLogChangeType.DELETE;

  if (!task_id || !activityLog.socket) return;
  if (old_value !== new_value) {
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.attribute_type = IActivityLogAttributeTypes.LABEL;

    insertToActivityLogs(activityLog);
  }
}

export async function logStatusChange(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;

  if (!task_id || !activityLog.socket) return;
  if (old_value !== new_value) {
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.attribute_type = IActivityLogAttributeTypes.STATUS;
    activityLog.log_type = IActivityLogChangeType.UPDATE;

    insertToActivityLogs(activityLog);
  }
}

export async function logPriorityChange(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;

  if (!task_id || !activityLog.socket) return;
  if (old_value !== new_value) {
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.attribute_type = IActivityLogAttributeTypes.PRIORITY;
    activityLog.log_type = IActivityLogChangeType.UPDATE;

    insertToActivityLogs(activityLog);
  }
}

export async function logDescriptionChange(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;

  if (!task_id || !activityLog.socket) return;
  if (old_value !== new_value) {
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.attribute_type = IActivityLogAttributeTypes.DESCRIPTION;
    activityLog.log_type = IActivityLogChangeType.UPDATE;

    insertToActivityLogs(activityLog);
  }
}

export async function logPhaseChange(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;
  if (!task_id || !activityLog.socket) return;

  if (old_value !== new_value) {
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.attribute_type = IActivityLogAttributeTypes.PHASE;
    activityLog.log_type = IActivityLogChangeType.UPDATE;

    insertToActivityLogs(activityLog);
  }
}

export async function logProgressChange(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;
  if (!task_id || !activityLog.socket) return;

  if (old_value !== new_value) {
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.attribute_type = IActivityLogAttributeTypes.PROGRESS;
    activityLog.log_type = IActivityLogChangeType.UPDATE;

    insertToActivityLogs(activityLog);
  }
}

export async function logWeightChange(activityLog: IActivityLog) {
  const { task_id, new_value, old_value } = activityLog;
  if (!task_id || !activityLog.socket) return;

  if (old_value !== new_value) {
    activityLog.user_id = getLoggedInUserIdFromSocket(activityLog.socket);
    activityLog.attribute_type = IActivityLogAttributeTypes.WEIGHT;
    activityLog.log_type = IActivityLogChangeType.UPDATE;

    insertToActivityLogs(activityLog);
  }
}
