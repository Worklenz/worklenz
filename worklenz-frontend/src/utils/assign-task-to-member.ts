import type { Socket } from 'socket.io-client';
import { SocketEvents } from '@/shared/socket-events';

/** Group id the backend uses for issues without assignees when grouping by assignee. */
export const UNASSIGNED_GROUP_ID = 'unassigned';

interface AssignTaskToMemberParams {
  socket: Socket | null | undefined;
  taskId: string;
  projectId: string;
  teamMemberId: string;
  reporterId?: string;
  teamId?: string;
  parentTaskId?: string | null;
}

/**
 * Adds a member as assignee of a task (used when an issue is created inside an
 * Assignee group). No-op for the Unassigned group.
 */
export const assignTaskToMember = ({
  socket,
  taskId,
  projectId,
  teamMemberId,
  reporterId,
  teamId,
  parentTaskId = null,
}: AssignTaskToMemberParams): void => {
  if (!socket || !teamMemberId || teamMemberId === UNASSIGNED_GROUP_ID) return;

  socket.emit(
    SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(),
    JSON.stringify({
      team_member_id: teamMemberId,
      project_id: projectId,
      task_id: taskId,
      reporter_id: reporterId,
      mode: 0,
      parent_task: parentTaskId,
      team_id: teamId,
    })
  );
};
