import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { isValidUuid } from "../../shared/validation-helpers";

interface CustomColumnPinnedChangeData {
  column_id: string;
  project_id: string;
  is_visible: boolean;
}

export const  on_custom_column_pinned_change = async (io: Server, socket: Socket, data: string) => {
  try {
    // Parse the data
    const parsedData: CustomColumnPinnedChangeData = typeof data === "string" ? JSON.parse(data) : data;
    const { column_id, project_id, is_visible } = parsedData;

    // Validate input data
    if (!column_id || !project_id || is_visible === undefined) {
      log_error("Invalid data for custom column pinned change");
      return;
    }

    let result: any = null;

    // Try to update by UUID first when the payload contains a valid UUID.
    if (isValidUuid(column_id)) {
      const updateQuery = `
        UPDATE cc_custom_columns 
        SET is_visible = $1, 
            updated_at = NOW() 
        WHERE id = $2 AND project_id = $3
        RETURNING id, key
      `;
      result = await db.query(updateQuery, [is_visible, column_id, project_id]);
    }

    // Fallback to updating by column key when the payload is not a UUID or the UUID did not match.
    if (!result || result.rowCount === 0) {
      const updateByKeyQuery = `
        UPDATE cc_custom_columns 
        SET is_visible = $1, 
            updated_at = NOW() 
        WHERE key = $2 AND project_id = $3
        RETURNING id, key
      `;
      result = await db.query(updateByKeyQuery, [is_visible, column_id, project_id]);
    }

    if (!result || result.rowCount === 0) {
      log_error("Custom column not found or not updated");
      return;
    }

    const updatedColumn = result.rows[0];
    
    // Broadcast the update to all clients in the project room
    socket.to(`project:${project_id}`).emit(
      SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(),
      JSON.stringify({
        column_id: updatedColumn.id,
        column_key: updatedColumn.key,
        is_visible,
      })
    );

    // Also send back to the sender for confirmation
    socket.emit(
      SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(),
      JSON.stringify({
        column_id: updatedColumn.id,
        column_key: updatedColumn.key,
        is_visible,
      })
    );
  } catch (error) {
    log_error(error);
  }
};