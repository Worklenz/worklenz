import { Badge, Flex, Select } from '@/shared/antd-imports';
import './home-tasks-status-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { ITaskStatus } from '@/types/status.types';
import { useState, useEffect, useMemo } from 'react';
import { ALPHA_CHANNEL } from '@/shared/constants';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useGetMyTasksQuery } from '@/api/home-page/home-page.api.service';

type HomeTasksStatusDropdownProps = {
  task: IProjectTask;
  teamId: string;
};

const HomeTasksStatusDropdown = ({ task, teamId }: HomeTasksStatusDropdownProps) => {
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();
  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const { refetch } = useGetMyTasksQuery(homeTasksConfig, {
    skip: false, // Ensure this query runs
  });

  const [selectedStatus, setSelectedStatus] = useState<ITaskStatus | undefined>(undefined);

  const handleStatusChange = (statusId: string) => {
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
  };

  const handleTaskStatusChange = (response: ITaskListStatusChangeResponse) => {
    if (response && response.id === task.id) {
      const updatedTask = {
        ...task,
        status_color: response.color_code,
        complete_ratio: +response.complete_ratio || 0,
        status_id: response.status_id,
        status_category: response.statusCategory,
      };
      setSelectedStatus(updatedTask);
      // Only refetch when there's an actual status change
      if (response.status_id !== task.status_id) {
        refetch();
      }
    }
  };

  const getTaskProgress = (taskId: string) => {
    socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), taskId);
  };

  useEffect(() => {
    const foundStatus = task.project_statuses?.find(status => status.id === task.status_id);
    setSelectedStatus(foundStatus);
  }, [task.status_id, task.project_statuses]);

  useEffect(() => {
    socket?.on(SocketEvents.TASK_STATUS_CHANGE.toString(), handleTaskStatusChange);

    return () => {
      socket?.removeListener(SocketEvents.TASK_STATUS_CHANGE.toString(), handleTaskStatusChange);
    };
  }, [connected]);

  const options = useMemo(
    () =>
      task.project_statuses?.map(status => ({
        value: status.id,
        label: (
          <Flex gap={8} align="center">
            <Badge color={status.color_code} text={status.name} />
          </Flex>
        ),
      })),
    [task.project_statuses]
  );

  return (
    <>
      {
        <Select
          variant="borderless"
          value={task.status_id}
          onChange={handleStatusChange}
          styles={{
            popup: {
              root: { borderRadius: 8, minWidth: 150, maxWidth: 200 },
            },
          }}
          style={{
            backgroundColor: selectedStatus?.color_code + ALPHA_CHANNEL,
            borderRadius: 16,
            height: 22,
          }}
          labelRender={value => {
            const status = task.project_statuses?.find(status => status.id === value.value);
            return status ? <span style={{ fontSize: 13 }}>{status.name}</span> : '';
          }}
          options={options}
        />
      }
    </>
  );
};

export default HomeTasksStatusDropdown;
