import { Server, Socket } from "socket.io";
import { SocketEvents } from "../events";
import db from "../../config/db";
import { log_error } from "../util";
import { verifyNonGuestTaskAccessSocket, logUnauthorizedSocketAccess } from "../authorization";
import {
  clearInvalidDependentValues,
  IClearedDependentValue,
  validateDependentSelectionValue,
} from "../../services/cascading-selection-service";

interface TaskCustomColumnUpdateData {
  task_id: string;
  column_key: string;
  value: string | number | boolean | string[] | null;
  project_id: string;
}

const normalizePeopleCustomColumnValue = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) return [];

    try {
      const parsedValue = JSON.parse(trimmedValue);
      if (Array.isArray(parsedValue)) {
        return parsedValue.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      }
    } catch {
      return [trimmedValue];
    }

    return [];
  }

  return [];
};

/**
 * After a Selection value changes, clears dependent-field values on the same task that are
 * no longer valid. Everyone in the project gets the plain update; only the sender gets
 * `auto_cleared`, so only they see the explanation toast.
 */
const broadcastClearedDependentValues = (
  socket: Socket,
  projectId: string,
  taskId: string,
  parentColumnName: string,
  parentValue: unknown,
  cleared: IClearedDependentValue[]
) => {
  for (const item of cleared) {
    const payload = { task_id: taskId, column_key: item.column_key, value: null };
    socket.to(`project:${projectId}`).emit(
      SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(),
      JSON.stringify(payload)
    );
    socket.emit(
      SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(),
      JSON.stringify({
        ...payload,
        auto_cleared: {
          field_name: item.column_name,
          previous_value: item.previous_value,
          parent_field_name: parentColumnName,
          parent_value: parentValue === null || parentValue === undefined ? null : String(parentValue),
        },
      })
    );
  }
};

export const on_task_custom_column_update = async (_io: Server, socket: Socket, data: string) => {
  try {
    // Parse the data
    const parsedData: TaskCustomColumnUpdateData = typeof data === "string" ? JSON.parse(data) : data;
    const { task_id, column_key, value } = parsedData;

    if (!task_id || !column_key || value === undefined) {
      console.error("Invalid data for task custom column update", { task_id, column_key, value });
      return;
    }

    // Resolve the task's actual project rather than trusting a client-supplied
    // project_id, which can go stale (e.g. after the task moves projects).
    const [hasAccess, taskProjectResult] = await Promise.all([
      verifyNonGuestTaskAccessSocket(socket, task_id),
      db.query(
        `SELECT project_id FROM tasks WHERE id = $1 LIMIT 1`,
        [task_id]
      ),
    ]);

    if (!hasAccess || taskProjectResult.rowCount === 0) {
      logUnauthorizedSocketAccess(socket, "TASK_CUSTOM_COLUMN_UPDATE", "task", task_id);
      console.warn("Unauthorized custom column update", { task_id, column_key });
      return;
    }

    const project_id = taskProjectResult.rows[0].project_id;

    // Get column information
    const columnQuery = `
      SELECT id, name, field_type 
      FROM cc_custom_columns 
      WHERE project_id = $1 AND key = $2
    `;
    const columnResult = await db.query(columnQuery, [project_id, column_key]);
    
    if (columnResult.rowCount === 0) {
      console.error("Custom column not found", { project_id, column_key });
      return;
    }
    
    const column = columnResult.rows[0];
    const columnId = column.id;
    const fieldType = column.field_type;
    
    const normalizedPeopleValue =
      fieldType === "people" ? normalizePeopleCustomColumnValue(value) : null;

    const isEmptyValue =
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0) ||
      (fieldType === "people" && normalizedPeopleValue !== null && normalizedPeopleValue.length === 0);

    const client = await db.pool.connect();
    let clearedDependents: IClearedDependentValue[] = [];
    let responseValue: unknown = isEmptyValue ? null : value;

    try {
      await client.query("BEGIN");
      await client.query(`SELECT 1 FROM tasks WHERE id = $1 FOR UPDATE`, [task_id]);

      if (fieldType === "selection" && !isEmptyValue) {
        const cascadeError = await validateDependentSelectionValue(task_id, columnId, value, client);
        if (cascadeError) {
          // Revert the sender's optimistic update to the stored value.
          const storedResult = await client.query(
            `SELECT text_value FROM cc_column_values WHERE task_id = $1 AND column_id = $2 LIMIT 1`,
            [task_id, columnId]
          );
          await client.query("ROLLBACK");

          socket.emit(
            SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(),
            JSON.stringify({
              task_id,
              column_key,
              value: storedResult.rows[0]?.text_value ?? null,
              rejected: true,
              error_code: cascadeError.error_code,
              message: cascadeError.message,
            })
          );
          return;
        }
      }

      if (isEmptyValue) {
        await client.query(
          `
            DELETE FROM cc_column_values
            WHERE task_id = $1 AND column_id = $2
          `,
          [task_id, columnId]
        );
      } else {
        // Determine which value field to use based on the field_type
        let textValue = null;
        let numberValue = null;
        let dateValue = null;
        let booleanValue = null;
        let jsonValue = null;
        
        switch (fieldType) {
          case "text":
            textValue = String(value);
            break;
          case "number":
            numberValue = parseFloat(String(value));
            break;
          case "date":
            dateValue = new Date(String(value));
            break;
          case "checkbox":
            booleanValue = Boolean(value);
            break;
          case "people":
            jsonValue = JSON.stringify(normalizedPeopleValue || []);
            break;
          default:
            textValue = String(value);
        }
        
        // Check if a value already exists
        const existingValueQuery = `
          SELECT id 
          FROM cc_column_values 
          WHERE task_id = $1 AND column_id = $2
        `;
        const existingValueResult = await client.query(existingValueQuery, [task_id, columnId]);
        
        if (existingValueResult.rowCount && existingValueResult.rowCount > 0) {
          // Update existing value
          const updateQuery = `
            UPDATE cc_column_values 
            SET text_value = $1, 
                number_value = $2, 
                date_value = $3, 
                boolean_value = $4, 
                json_value = $5, 
                updated_at = NOW() 
            WHERE task_id = $6 AND column_id = $7
          `;
          await client.query(updateQuery, [
            textValue, 
            numberValue, 
            dateValue, 
            booleanValue, 
            jsonValue, 
            task_id, 
            columnId
          ]);
        } else {
          // Insert new value
          const insertQuery = `
            INSERT INTO cc_column_values 
            (task_id, column_id, text_value, number_value, date_value, boolean_value, json_value, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          `;
          await client.query(insertQuery, [
            task_id, 
            columnId, 
            textValue, 
            numberValue, 
            dateValue, 
            booleanValue, 
            jsonValue
          ]);
        }
      }

      if (fieldType === "selection") {
        clearedDependents = await clearInvalidDependentValues(task_id, columnId, client);
      }

      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback errors
      }
      throw error;
    } finally {
      client.release();
    }

    // Broadcast only after the transaction commits.
    socket.to(`project:${project_id}`).emit(
      SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(),
      JSON.stringify({
        task_id,
        column_key,
        value: responseValue
      })
    );

    socket.emit(
      SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(),
      JSON.stringify({
        task_id,
        column_key,
        value: responseValue
      })
    );

    if (fieldType === "selection" && clearedDependents.length > 0) {
      broadcastClearedDependentValues(
        socket,
        project_id,
        task_id,
        column.name,
        responseValue,
        clearedDependents
      );
    }
  } catch (error) {
    log_error(error);
    console.error("Error updating task custom column", error);
  }
};
