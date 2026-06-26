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

    // Only attempt the UUID query when BOTH column_id and project_id are valid UUIDs.
    // If either is a nanoid/key string the PostgreSQL UUID cast will throw, so we skip
    // straight to the key-based fallback in that case.
    if (isValidUuid(column_id) && isValidUuid(project_id)) {
      try {
        const updateQuery = `
          UPDATE cc_custom_columns 
          SET is_visible = $1, 
              updated_at = NOW() 
          WHERE id = $2 AND project_id = $3
          RETURNING id, key
        `;
        result = await db.query(updateQuery, [is_visible, column_id, project_id]);
      } catch (uuidQueryError) {
        // Swallow UUID cast errors and fall through to the key-based query below.
        result = null;
      }
    }

    // Fallback: update by column key (text column — safe for both UUIDs and nanoid keys).
    if (!result || result.rowCount === 0) {
      const updateByKeyQuery = `
        UPDATE cc_custom_columns 
        SET is_visible = $1, 
            updated_at = NOW() 
        WHERE key = $2 AND project_id = $3::uuid
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