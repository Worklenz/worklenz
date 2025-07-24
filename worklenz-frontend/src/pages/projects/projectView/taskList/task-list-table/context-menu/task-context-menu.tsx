import {
  DeleteOutlined,
  DoubleRightOutlined,
  InboxOutlined,
  LoadingOutlined,
  RetweetOutlined,
  UserAddOutlined,
} from '@/shared/antd-imports';
import { Badge, Dropdown, Flex, Typography, Modal } from '@/shared/antd-imports';
import { MenuProps } from 'antd/lib';
import { useState } from 'react';
import { TFunction } from 'i18next';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { taskListBulkActionsApiService } from '@/api/tasks/task-list-bulk-actions.api.service';
import { IBulkAssignRequest } from '@/types/tasks/bulk-action-bar.types';
import {
  evt_project_task_list_context_menu_archive,
  evt_project_task_list_context_menu_assign_me,
  evt_project_task_list_context_menu_delete,
} from '@/shared/worklenz-analytics-events';
import {
  deleteTask,
  fetchTaskAssignees,
  fetchTaskGroups,
  IGroupBy,
  setConvertToSubtaskDrawerOpen,
  updateTaskAssignees,
} from '@/features/tasks/tasks.slice';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { tasksApiService } from '@/api/tasks/tasks.api.service';

type TaskContextMenuProps = {
  visible: boolean;
  position: { x: number; y: number };
  selectedTask: IProjectTask;
  onClose: () => void;
  t: TFunction;
};

const TaskContextMenu = ({ visible, position, selectedTask, onClose, t }: TaskContextMenuProps) => {
  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const currentSession = useAuthService().getCurrentSession();

  const { projectId } = useAppSelector(state => state.projectReducer);
  const { taskGroups, archived, groupBy } = useAppSelector(state => state.taskReducer);
  const [updatingAssignToMe, setUpdatingAssignToMe] = useState(false);

  const handleAssignToMe = async () => {
    if (!projectId || !selectedTask.id) return;

    try {
      setUpdatingAssignToMe(true);
      const body: IBulkAssignRequest = {
        tasks: [selectedTask.id],
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.assignToMe(body);
      if (res.done) {
        const { id: taskId, assignees } = res.body;
        trackMixpanelEvent(evt_project_task_list_context_menu_assign_me);
        const groupId = taskGroups.find(group =>
          group.tasks.some(
            task => task.id === taskId || task.sub_tasks?.some(subtask => subtask.id === taskId)
          )
        )?.id;

        if (groupId) {
          dispatch(
            updateTaskAssignees({
              groupId,
              taskId,
              assignees,
            })
          );

          if (currentSession?.team_id) {
            dispatch(fetchTaskAssignees(currentSession.team_id));
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingAssignToMe(false);
    }
  };

  const handleArchive = async () => {
    if (!projectId || !selectedTask.id) return;

    try {
      const res = await taskListBulkActionsApiService.archiveTasks(
        {
          tasks: [selectedTask.id],
          project_id: projectId,
        },
        archived ? true : false
      );

      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_context_menu_archive);
        dispatch(deleteTask({ taskId: selectedTask.id }));
        dispatch(deselectAll());
        if (selectedTask.parent_task_id)
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), selectedTask.parent_task_id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!projectId || !selectedTask.id) return;

    try {
      const res = await taskListBulkActionsApiService.deleteTasks(
        { tasks: [selectedTask.id] },
        projectId
      );

      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_context_menu_delete);
        dispatch(deleteTask({ taskId: selectedTask.id }));
        dispatch(deselectAll());
        if (selectedTask.parent_task_id)
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), selectedTask.parent_task_id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleStatusMoveTo = async (targetId: string | undefined) => {
    if (!projectId || !selectedTask.id || !targetId) return;

    try {
      socket?.emit(
        SocketEvents.TASK_STATUS_CHANGE.toString(),
        JSON.stringify({
          task_id: selectedTask.id,
          status_id: targetId,
          parent_task: selectedTask.parent_task_id || null,
          team_id: currentSession?.team_id,
        })
      );
    } catch (error) {
      logger.error('Error moving status', error);
    }
  };

  const handlePriorityMoveTo = async (targetId: string | undefined) => {
    if (!projectId || !selectedTask.id || !targetId) return;

    try {
      socket?.emit(
        SocketEvents.TASK_PRIORITY_CHANGE.toString(),
        JSON.stringify({
          task_id: selectedTask.id,
          priority_id: targetId,
          parent_task: selectedTask.parent_task_id || null,
          team_id: currentSession?.team_id,
        })
      );
    } catch (error) {
      logger.error('Error moving priority', error);
    }
  };

  const handlePhaseMoveTo = async (targetId: string | undefined) => {
    if (!projectId || !selectedTask.id || !targetId) return;

    try {
      socket?.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
        task_id: selectedTask.id,
        phase_id: targetId,
        parent_task: selectedTask.parent_task_id || null,
        team_id: currentSession?.team_id,
      });
    } catch (error) {
      logger.error('Error moving phase', error);
    }
  };

  const getMoveToOptions = () => {
    if (groupBy === IGroupBy.STATUS) {
      return statusList?.map(status => ({
        key: status.id,
        label: (
          <Flex align="center" gap={8}>
            <Badge color={status.color_code} />
            <Typography.Text>{status.name}</Typography.Text>
          </Flex>
        ),
        onClick: () => handleStatusMoveTo(status.id),
      }));
    }
    if (groupBy === IGroupBy.PRIORITY) {
      return priorityList?.map(priority => ({
        key: priority.id,
        label: (
          <Flex align="center" gap={8}>
            <Badge color={priority.color_code} />
            <Typography.Text>{priority.name}</Typography.Text>
          </Flex>
        ),
        onClick: () => handlePriorityMoveTo(priority.id),
      }));
    }
    if (groupBy === IGroupBy.PHASE) {
      return phaseList?.map(phase => ({
        key: phase.id,
        label: (
          <Flex align="center" gap={8}>
            <Badge color={phase.color_code} />
            <Typography.Text>{phase.name}</Typography.Text>
          </Flex>
        ),
        onClick: () => handlePhaseMoveTo(phase.id),
      }));
    }
    return [];
  };

  const handleConvertToTask = async () => {
    if (!selectedTask?.id || !projectId) return;

    try {
      const res = await tasksApiService.convertToTask(
        selectedTask.id as string,
        projectId as string
      );
      if (res.done) {
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
      }
    } catch (error) {
      logger.error('Error converting to task', error);
    }
  };

  const items: MenuProps['items'] = [
    {
      key: '1',
      icon: updatingAssignToMe ? <LoadingOutlined /> : <UserAddOutlined />,
      label: t('contextMenu.assignToMe'),
      onClick: handleAssignToMe,
      disabled: updatingAssignToMe,
    },
    {
      key: '2',
      icon: <RetweetOutlined />,
      label: t('contextMenu.moveTo'),
      children: getMoveToOptions(),
    },
    ...(!selectedTask?.parent_task_id
      ? [
          {
            key: '3',
            icon: <InboxOutlined />,
            label: archived ? t('contextMenu.unarchive') : t('contextMenu.archive'),
            onClick: handleArchive,
          },
        ]
      : []),
    ...(selectedTask?.sub_tasks_count === 0 && !selectedTask?.parent_task_id
      ? [
          {
            key: '4',
            icon: <DoubleRightOutlined />,
            label: t('contextMenu.convertToSubTask'),
            onClick: () => dispatch(setConvertToSubtaskDrawerOpen(true)),
          },
        ]
      : []),
    ...(selectedTask?.parent_task_id
      ? [
          {
            key: '5',
            icon: <DoubleRightOutlined />,
            label: t('contextMenu.convertToTask'),
            onClick: () => {
              handleConvertToTask();
            },
          },
        ]
      : []),
    {
      key: '6',
      icon: <DeleteOutlined />,
      label: t('contextMenu.delete'),
      onClick: handleDelete,
    },
  ];

  return visible ? (
    <Dropdown menu={{ items }} trigger={['contextMenu']} open={visible} onOpenChange={onClose}>
      <div
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          zIndex: 1000,
          width: 1,
          height: 1,
        }}
      ></div>
    </Dropdown>
  ) : null;
};

export default TaskContextMenu;
