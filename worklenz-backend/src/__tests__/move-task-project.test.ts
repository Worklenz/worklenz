jest.mock('../config/db', () => ({
  __esModule: true,
  default: { connect: jest.fn(), query: jest.fn() },
}));

import db from '../config/db';
import TasksControllerV2 from '../controllers/tasks-controller-v2';
import validateMoveTaskProject from '../middlewares/validators/move-task-project-validator';
import type { IWorkLenzRequest } from '../interfaces/worklenz-request';
import type { IWorkLenzResponse } from '../interfaces/worklenz-response';
import { TaskMoveService } from '../services/task-move.service';
import { IO } from '../shared/io';
import { SocketEvents } from '../socket.io/events';
import * as storage from '../shared/storage';

const taskId = '11111111-1111-4111-8111-111111111111';
const sourceId = '22222222-2222-4222-8222-222222222222';
const destinationId = '33333333-3333-4333-8333-333333333333';
const statusId = '44444444-4444-4444-8444-444444444444';
const destinationStatusId = '55555555-5555-4555-8555-555555555555';

const makeRequest = () => ({
  user: { id: taskId, team_id: sourceId, owner: true },
  body: {
    task_ids: [taskId], source_project_id: sourceId, destination_project_id: destinationId,
    mapping: { status: { [statusId]: destinationStatusId } },
    options: { move_subtasks: true, keep_assignees_if_member_exists: true, keep_labels_by_name: true },
  },
} as unknown as IWorkLenzRequest);
const makeResponse = () => {
  const response = { status: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis() };
  return { response, res: response as unknown as IWorkLenzResponse };
};

describe('move tasks between projects', () => {
  beforeEach(() => jest.clearAllMocks());

  it('broadcasts to both project rooms even when the sender socket is missing', () => {
    const socketSpy = jest.spyOn(IO, 'getSocketById').mockReturnValue(null);
    const roomSpy = jest.spyOn(IO, 'emitToProjectRoom').mockImplementation(() => {});
    TaskMoveService.notifyProjectUpdatesForMove('stale-socket', sourceId, destinationId);
    const event = SocketEvents.PROJECT_UPDATES_AVAILABLE.toString();
    expect(roomSpy).toHaveBeenCalledWith(sourceId, event, undefined, { excludeSocketId: 'stale-socket' });
    expect(roomSpy).toHaveBeenCalledWith(destinationId, event, undefined, { excludeSocketId: 'stale-socket' });
    socketSpy.mockRestore();
    roomSpy.mockRestore();
  });

  it('rejects invalid payloads before project access checks', () => {
    const req = makeRequest();
    req.body.task_ids = ['not-a-uuid'];
    const { response, res } = makeResponse();
    const next = jest.fn();
    validateMoveTaskProject(req, res, next);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rolls back when the destination is outside the active workspace', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('WITH RECURSIVE')) return { rows: [{ id: taskId }], rowCount: 1 };
      if (sql.includes('SELECT id FROM projects')) return { rows: [{ id: sourceId }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const release = jest.fn();
    jest.mocked(db.connect).mockResolvedValue({ query, release } as unknown as Awaited<ReturnType<typeof db.connect>>);
    const { response, res } = makeResponse();
    await TasksControllerV2.moveTasksToProject(makeRequest(), res);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rolls back without changing attachment ownership if a file copy fails', async () => {
    const copySpy = jest.spyOn(storage, 'copyObject').mockResolvedValue(false);
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('WITH RECURSIVE')) return { rows: [{ id: taskId }], rowCount: 1 };
      if (sql.includes('SELECT id FROM projects')) return { rows: [{ id: sourceId }, { id: destinationId }], rowCount: 2 };
      if (sql.includes('FOR UPDATE') && sql.includes('FROM tasks')) return { rows: [{ id: taskId, project_id: sourceId, status_id: statusId }], rowCount: 1 };
      if (sql.includes('FROM task_statuses')) return { rows: [{ id: params?.[0] === sourceId ? statusId : destinationStatusId, name: 'Open', is_done: false, is_todo: true }], rowCount: 1 };
      if (sql.includes('MAX(sort_order)')) return { rows: [{ max_sort: 0 }], rowCount: 1 };
      if (sql.includes('RETURNING tasks_counter')) return { rows: [{ tasks_counter: 1 }], rowCount: 1 };
      if (sql.includes('FROM task_attachments WHERE')) return { rows: [{ id: taskId, team_id: sourceId, project_id: sourceId, type: 'png' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    jest.mocked(db.connect).mockResolvedValue({ query, release: jest.fn() } as unknown as Awaited<ReturnType<typeof db.connect>>);
    const request = makeRequest();
    await expect(TaskMoveService.moveTasksToProject(request.body, request.user)).rejects.toThrow('Failed to copy task attachment');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE task_attachments SET project_id'))).toBe(false);
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    copySpy.mockRestore();
  });

  it('moves a task on one connection and commits its activity log atomically', async () => {
    const refreshSpy = jest.spyOn(TasksControllerV2, 'refreshProjectTaskProgressValues').mockResolvedValue(undefined);
    const copySpy = jest.spyOn(storage, 'copyObject').mockResolvedValue(true);
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('WITH RECURSIVE')) return { rows: [{ id: taskId }], rowCount: 1 };
      if (sql.includes('SELECT id FROM projects')) return { rows: [{ id: sourceId }, { id: destinationId }], rowCount: 2 };
      if (sql.includes('FOR UPDATE') && sql.includes('FROM tasks')) return { rows: [{ id: taskId, project_id: sourceId, status_id: statusId }], rowCount: 1 };
      if (sql.includes('FROM task_statuses')) return { rows: [{ id: params?.[0] === sourceId ? statusId : destinationStatusId, name: 'Open', is_done: false, is_todo: true }], rowCount: 1 };
      if (sql.includes('SELECT id, name') && sql.includes('FROM projects')) return { rows: [{ id: sourceId, name: 'Source' }, { id: destinationId, name: 'Destination' }], rowCount: 2 };
      if (sql.includes('DELETE FROM task_dependencies')) return { rows: [{ task_id: taskId, related_task_id: '99999999-9999-4999-8999-999999999999' }], rowCount: 1 };
      if (sql.includes('MAX(sort_order)')) return { rows: [{ max_sort: 0 }], rowCount: 1 };
      if (sql.includes('RETURNING tasks_counter')) return { rows: [{ tasks_counter: 10 }], rowCount: 1 };
      if (sql.includes('FROM task_attachments WHERE')) return { rows: [{ id: taskId, team_id: sourceId, project_id: sourceId, type: 'png' }], rowCount: 1 };
      if (sql.includes('FROM task_comment_attachments WHERE')) return { rows: [{ id: statusId, team_id: sourceId, project_id: sourceId, task_id: taskId, comment_id: destinationId, type: 'png' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const release = jest.fn();
    jest.mocked(db.connect).mockResolvedValue({ query, release } as unknown as Awaited<ReturnType<typeof db.connect>>);
    const { response, res } = makeResponse();
    await TasksControllerV2.moveTasksToProject(makeRequest(), res);
    expect(response.status).toHaveBeenCalledWith(200);
    // Deadlock prevention: deterministic row locking order
    expect(query.mock.calls.some(([sql]) => sql.includes('ORDER BY id') && sql.includes('FOR UPDATE'))).toBe(true);
    // Activity log inserted
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO task_activity_logs'))).toBe(true);
    // Task updated with status, sort, task_no, and completion sync
    expect(query.mock.calls.some(([sql, params]) => sql.includes('parent_task_id = CASE') && sql.includes('done = $7') && params?.[5] === 10)).toBe(true);
    expect(query.mock.calls.some(([sql, params]) => sql.includes('release_id = NULL') && params?.[0] === taskId && params?.[1] === destinationId)).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes('epic_id = CASE WHEN epic_id = ANY'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes('UPDATE tasks SET epic_id = NULL'))).toBe(true);
    expect(copySpy).toHaveBeenCalledWith(storage.getKey(sourceId, sourceId, taskId, 'png'), storage.getKey(sourceId, destinationId, taskId, 'png'));
    expect(copySpy).toHaveBeenCalledWith(storage.getTaskAttachmentKey(sourceId, sourceId, taskId, destinationId, statusId, 'png'), storage.getTaskAttachmentKey(sourceId, destinationId, taskId, destinationId, statusId, 'png'));
    expect(query).toHaveBeenCalledWith('UPDATE task_attachments SET project_id = $2 WHERE task_id = ANY($1::UUID[])', [[taskId], destinationId]);
    expect(query).toHaveBeenCalledWith('UPDATE task_comment_attachments SET project_id = $2 WHERE task_id = ANY($1::UUID[])', [[taskId], destinationId]);
    // Cross-project dependencies cleanup
    expect(query.mock.calls.some(([sql]) => sql.includes('DELETE FROM task_dependencies'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes('RETURNING tasks_counter'))).toBe(true);
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
    // Progress refreshed for both projects
    expect(refreshSpy).toHaveBeenCalledWith(sourceId);
    expect(refreshSpy).toHaveBeenCalledWith(destinationId);
    refreshSpy.mockRestore();
    copySpy.mockRestore();
  });
});
