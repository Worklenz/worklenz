import db from "../../config/db";

export interface RecordTaskStatusHistoryInput {
  taskId: string;
  newStatusId: string;
  previousStatusId?: string | null;
  changedBy?: string | null;
}

/**
 * Closes the open status-history row and inserts a new one for the new status.
 * Safe to call from socket + REST status-change paths.
 */
export async function recordTaskStatusHistory(
  input: RecordTaskStatusHistoryInput
): Promise<void> {
  const { taskId, newStatusId, previousStatusId, changedBy } = input;
  if (!taskId || !newStatusId) return;
  if (previousStatusId && previousStatusId === newStatusId) return;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const projectResult = await client.query(
      `SELECT project_id FROM tasks WHERE id = $1::UUID`,
      [taskId]
    );
    const projectId = projectResult.rows[0]?.project_id as string | undefined;
    if (!projectId) {
      await client.query("ROLLBACK");
      return;
    }

    await client.query(
      `
      UPDATE task_status_history
      SET exited_at = CURRENT_TIMESTAMP
      WHERE task_id = $1::UUID
        AND exited_at IS NULL
      `,
      [taskId]
    );

    await client.query(
      `
      INSERT INTO task_status_history (
        task_id,
        project_id,
        status_id,
        previous_status_id,
        entered_at,
        changed_by
      ) VALUES (
        $1::UUID,
        $2::UUID,
        $3::UUID,
        $4::UUID,
        CURRENT_TIMESTAMP,
        $5::UUID
      )
      `,
      [taskId, projectId, newStatusId, previousStatusId || null, changedBy || null]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
