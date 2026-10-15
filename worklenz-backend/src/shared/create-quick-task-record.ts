import db from "../config/db";

interface ICreatedQuickTask {
  id: string;
  project_id: string;
  issue_type?: string;
  status?: string | null;
  chart_start?: string;
  [key: string]: unknown;
}

interface IQuickTaskCreationRow {
  task: ICreatedQuickTask | null;
}

const QUICK_TASK_ISSUE_TYPES = ["task", "story", "bug"];

/** Persist the task and its issue type together before acknowledging creation. */
export async function createQuickTaskRecord(body: string, projectId: string, issueType?: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<IQuickTaskCreationRow>("SELECT create_quick_task($1) AS task;", [body]);
    const [row] = result.rows;
    if (row?.task && issueType && QUICK_TASK_ISSUE_TYPES.includes(issueType) && issueType !== "task") {
      const update = await client.query(
        "UPDATE tasks SET issue_type = $2 WHERE id = $1 AND project_id = $3;",
        [row.task.id, issueType, projectId]
      );
      if (update.rowCount !== 1) throw new Error("Created task not found in its project");
      row.task.issue_type = issueType;
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
