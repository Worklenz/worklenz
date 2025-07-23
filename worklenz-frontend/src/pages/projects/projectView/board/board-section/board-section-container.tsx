import { Flex } from '@/shared/antd-imports';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import BoardSectionCard from './board-section-card/board-section-card';
import BoardCreateSectionCard from './board-section-card/board-create-section-card';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import React, { useEffect } from 'react';
import { setTaskAssignee, setTaskEndDate } from '@/features/task-drawer/task-drawer.slice';
import { fetchTaskAssignees } from '@/features/taskAttributes/taskMemberSlice';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { updateTaskAssignees, updateTaskEndDate } from '@/features/board/board-slice';
import useIsProjectManager from '@/hooks/useIsProjectManager';

const BoardSectionCardContainer = ({
  datasource,
  group,
}: {
  datasource: ITaskListGroup[];
  group: 'status' | 'priority' | 'phases' | 'members';
}) => {
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const { taskGroups } = useAppSelector(state => state.boardReducer);
  const { loadingAssignees } = useAppSelector(state => state.taskReducer);
  const isOwnerorAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();

  // Socket handler for assignee updates
  useEffect(() => {
    if (!socket) return;

    const handleAssigneesUpdate = (data: ITaskAssigneesUpdateResponse) => {
      if (!data) return;

      const updatedAssignees = data.assignees.map(assignee => ({
        ...assignee,
        selected: true,
      }));

      // Find the group that contains the task or its subtasks
      const groupId = taskGroups.find(group =>
        group.tasks.some(
          task =>
            task.id === data.id ||
            (task.sub_tasks && task.sub_tasks.some(subtask => subtask.id === data.id))
        )
      )?.id;

      if (groupId) {
        dispatch(
          updateTaskAssignees({
            groupId,
            taskId: data.id,
            assignees: updatedAssignees,
            names: data.names,
          })
        );

        dispatch(setTaskAssignee(data));

        if (currentSession?.team_id && !loadingAssignees) {
          dispatch(fetchTaskAssignees(currentSession.team_id));
        }
      }
    };

    socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), handleAssigneesUpdate);
    return () => {
      socket.off(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), handleAssigneesUpdate);
    };
  }, [socket, currentSession?.team_id, loadingAssignees, taskGroups, dispatch]);

  // Socket handler for due date updates
  useEffect(() => {
    if (!socket) return;

    const handleEndDateChange = (task: {
      id: string;
      parent_task: string | null;
      end_date: string;
    }) => {
      dispatch(updateTaskEndDate({ task }));
      dispatch(setTaskEndDate(task));
    };

    socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleEndDateChange);

    return () => {
      socket.off(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleEndDateChange);
    };
  }, [socket, dispatch]);

  return (
    <Flex
      gap={16}
      align="flex-start"
      className="max-w-screen max-h-[620px] min-h-[620px] overflow-x-scroll p-px"
    >
      <SortableContext
        items={datasource?.map((section: any) => section.id)}
        strategy={horizontalListSortingStrategy}
      >
        {datasource?.map((data: any) => <BoardSectionCard key={data.id} taskGroup={data} />)}
      </SortableContext>

      {group !== 'priority' && (isOwnerorAdmin || isProjectManager) && <BoardCreateSectionCard />}
    </Flex>
  );
};

export default React.memo(BoardSectionCardContainer);
