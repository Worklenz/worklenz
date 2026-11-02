/**
 * Task status history is recorded by the database trigger
 * `tasks_record_status_history` (see pg-migration 1792800003000).
 *
 * This helper remains for call sites that previously recorded history in app
 * code. It is intentionally a no-op so socket/REST paths do not double-insert
 * alongside the trigger. Prefer relying on the trigger for all status writes.
 */
export interface RecordTaskStatusHistoryInput {
  taskId: string;
  newStatusId: string;
  previousStatusId?: string | null;
  changedBy?: string | null;
}

export async function recordTaskStatusHistory(
  _input: RecordTaskStatusHistoryInput
): Promise<void> {
  // History is owned by the DB trigger on tasks.status_id.
}
