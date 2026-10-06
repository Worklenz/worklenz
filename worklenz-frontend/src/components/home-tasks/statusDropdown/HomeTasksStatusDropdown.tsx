import { Badge, Dropdown, Flex } from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import './home-tasks-status-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { ITaskStatus } from '@/types/status.types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { TruncatedColoredTag } from '@/components/common/truncated-colored-tag/TruncatedColoredTag';
import { toSolidTagColor } from '@/utils/colorUtils';

interface HomeTasksStatusDropdownProps {
  task: IProjectTask;
  teamId: string;
}

const HomeTasksStatusDropdown = ({ task, teamId }: HomeTasksStatusDropdownProps) => {
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const [selectedStatus, setSelectedStatus] = useState<ITaskStatus | undefined>(undefined);

  const getTaskProgress = useCallback(
    (taskId: string) => {
      socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), taskId);
    },
    [socket]
  );

  const handleStatusChange = useCallback(
    (statusId: string) => {
      if (!task.id || !statusId) return;

      socket?.emit(
        SocketEvents.TASK_STATUS_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          status_id: statusId,
          parent_task: task.parent_task_id || null,
          team_id: teamId,
        })
      );
      getTaskProgress(task.id);
    },
    [socket, task.id, task.parent_task_id, teamId, getTaskProgress]
  );

  const handleTaskStatusChange = useCallback(
    (response: ITaskListStatusChangeResponse) => {
      if (!response || response.id !== task.id) return;

      const found = task.project_statuses?.find(status => status.id === response.status_id);
      if (found) {
        setSelectedStatus(found);
        return;
      }

      setSelectedStatus({
        id: response.status_id,
        name: response.status_name,
        color_code: response.color_code,
        color_code_dark: response.color_code_dark,
      });
    },
    [task.id, task.project_statuses]
  );

  useEffect(() => {
    const foundStatus = task.project_statuses?.find(status => status.id === task.status_id);
    if (foundStatus) {
      setSelectedStatus(foundStatus);
      return;
    }

    // Fallback when project_statuses aren't loaded — use fields on the task itself
    if (task.status_id || task.status_name) {
      setSelectedStatus({
        id: task.status_id,
        name: task.status_name,
        color_code: task.status_color,
        color_code_dark: task.status_color_dark,
      });
      return;
    }

    setSelectedStatus(undefined);
  }, [
    task.status_id,
    task.status_name,
    task.status_color,
    task.status_color_dark,
    task.project_statuses,
  ]);

  useEffect(() => {
    if (!connected) return;

    socket?.on(SocketEvents.TASK_STATUS_CHANGE.toString(), handleTaskStatusChange);

    return () => {
      socket?.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), handleTaskStatusChange);
    };
  }, [connected, socket, handleTaskStatusChange]);

  const menuItems: MenuProps['items'] = useMemo(
    () =>
      task.project_statuses?.map(status => ({
        key: status.id || '',
        label: (
          <Flex gap={8} align="center">
            <Badge color={status.color_code} text={status.name} />
          </Flex>
        ),
        onClick: () => {
          if (status.id) handleStatusChange(status.id);
        },
      })),
    [task.project_statuses, handleStatusChange]
  );

  const statusColor = toSolidTagColor(
    (themeMode === 'dark' ? selectedStatus?.color_code_dark : selectedStatus?.color_code) ??
      selectedStatus?.color_code
  );

  const statusLabel = selectedStatus?.name;
  if (!statusLabel) return null;

  const hasMenu = (menuItems?.length ?? 0) > 0;

  // Same TruncatedColoredTag pill as Home > Log Time Status column
  const statusTag = (
    <TruncatedColoredTag label={statusLabel} color={statusColor} />
  );

  if (!hasMenu) return statusTag;

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['click']}
      placement="bottomLeft"
      overlayClassName="home-status-dropdown"
    >
      <button
        type="button"
        className="home-status-tag-trigger"
        aria-label={t('changeStatus', {
          defaultValue: 'Change status: {{status}}',
          status: statusLabel,
        })}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
          }
        }}
      >
        {statusTag}
      </button>
    </Dropdown>
  );
};

export default HomeTasksStatusDropdown;
