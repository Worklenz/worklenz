import { Server, Socket } from "socket.io";
import { SocketEvents } from "../events";
import db from "../../config/db";
import { log_error } from "../util";

interface TaskCustomColumnUpdateData {
  task_id: string;
  column_key: string;
  value: string | number | boolean;
  project_id: string;
}

export const on_task_custom_column_update = async (_io: Server, socket: Socket, data: string) => {
  try {
    // Parse the data
    const parsedData: TaskCustomColumnUpdateData = typeof data === "string" ? JSON.parse(data) : data;
    const { task_id, column_key, value, project_id } = parsedData;

    if (!task_id || !column_key || value === undefined || !project_id) {
      console.error("Invalid data for task custom column update", { task_id, column_key, value, project_id });
      return;
    }

    // Get column information
    const columnQuery = `
      SELECT id, field_type 
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
    
    // Determine which value field to use based on the field_type
    let textValue = null;
    let numberValue = null;
    let dateValue = null;
    let booleanValue = null;
    let jsonValue = null;
    
    switch (fieldType) {
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
        jsonValue = JSON.stringify(Array.isArray(value) ? value : [value]);
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
    const existingValueResult = await db.query(existingValueQuery, [task_id, columnId]);
    
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
      await db.query(updateQuery, [
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
      await db.query(insertQuery, [
        task_id, 
        columnId, 
        textValue, 
        numberValue, 
        dateValue, 
        booleanValue, 
        jsonValue
      ]);
    }

    // Broadcast the update to all clients in the project room
    socket.to(`project:${project_id}`).emit(
      SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(),
      JSON.stringify({
        task_id,
        column_key,
        value
      })
    );

    // Also send back to the sender for confirmation
    socket.emit(
      SocketEvents.TASK_CUSTOM_COLUMN_UPDATE.toString(),
      JSON.stringify({
        task_id,
        column_key,
        value
      })
    );

    console.log("Task custom column updated successfully", { task_id, column_key });
  } catch (error) {
    log_error(error);
    console.error("Error updating task custom column", error);
  }
}; 