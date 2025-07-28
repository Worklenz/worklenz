import {
  Button,
  Flex,
  Input,
  Popconfirm,
  Progress,
  Table,
  Tag,
  Tooltip,
} from '@/shared/antd-imports';
import { useState, useMemo, useEffect } from 'react';
import { DeleteOutlined, EditOutlined, ExclamationCircleFilled } from '@/shared/antd-imports';
import { nanoid } from '@reduxjs/toolkit';
import { TFunction } from 'i18next';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { colors } from '@/styles/colors';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ISubTask } from '@/types/tasks/subTask.types';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import Avatars from '@/components/avatars/avatars';
import './subtask-table.css';
import { ITaskCreateRequest } from '@/types/tasks/task-create-request.types';
import { getUserSession } from '@/utils/session-helper';
import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import {
  getCurrentGroup,
  GROUP_BY_STATUS_VALUE,
  GROUP_BY_PRIORITY_VALUE,
  GROUP_BY_PHASE_VALUE,
} from '@/features/tasks/tasks.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import logger from '@/utils/errorLogger';
import {
  setShowTaskDrawer,
  setSelectedTaskId,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { updateSubtask } from '@/features/board/board-slice';
import { updateEnhancedKanbanSubtask } from '@/features/enhanced-kanban/enhanced-kanban.slice';

type SubTaskTableProps = {
  subTasks: ISubTask[];
  loadingSubTasks: boolean;
  refreshSubTasks: () => void;
  t: TFunction;
};

const SubTaskTable = ({ subTasks, loadingSubTasks, refreshSubTasks, t }: SubTaskTableProps) => {
  const { socket, connected } = useSocket();
  const [isEdit, setIsEdit] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const { taskFormViewModel, selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const currentSession = getUserSession();
  const { projectView } = useTabSearchParam();
  const dispatch = useAppDispatch();

  const createRequestBody = (taskName: string): ITaskCreateRequest | null => {
    if (!projectId || !currentSession) return null;

    const body: ITaskCreateRequest = {
      project_id: projectId,
      name: taskName,
      reporter_id: currentSession.id,
      team_id: currentSession.team_id,
    };

    const groupBy = getCurrentGroup();
    const task = taskFormViewModel?.task;

    if (groupBy.value === GROUP_BY_STATUS_VALUE) {
      body.status_id = task?.status_id;
    } else if (groupBy.value === GROUP_BY_PRIORITY_VALUE) {
      body.priority_id = task?.priority_id;
    } else if (groupBy.value === GROUP_BY_PHASE_VALUE) {
      body.phase_id = task?.phase_id;
    }

    if (selectedTaskId) {
      body.parent_task_id = selectedTaskId;
    }

    return body;
  };

  const addInstantTask = async (taskName: string) => {
    if (creatingTask || !taskName?.trim() || !connected) return;

    try {
      setCreatingTask(true);
      const body = createRequestBody(taskName);
      if (!body) return;

      socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
      socket?.once(SocketEvents.QUICK_TASK.toString(), (task: IProjectTask) => {
        if (task.parent_task_id) {
          refreshSubTasks();
          dispatch(updateSubtask({ sectionId: '', subtask: task, mode: 'add' }));

          // Note: Enhanced kanban updates are now handled by the global socket handler
          // No need to dispatch here as it will be handled by useTaskSocketHandlers
        }
      });
    } catch (error) {
      console.error('Error adding subtask:', error);
    } finally {
      setCreatingTask(false);
      setNewTaskName('');
      setIsEdit(true);
    }
  };

  const handleDeleteSubTask = async (taskId?: string) => {
    if (!taskId) return;

    try {
      await tasksApiService.deleteTask(taskId);
      dispatch(
        updateEnhancedKanbanSubtask({
          sectionId: '',
          subtask: { id: taskId, parent_task_id: selectedTaskId || '', manual_progress: false },
          mode: 'delete',
        })
      );
      dispatch(
        updateSubtask({
          sectionId: '',
          subtask: { id: taskId, parent_task_id: selectedTaskId || '' },
          mode: 'delete',
        })
      );

      refreshSubTasks();
    } catch (error) {
      logger.error('Error deleting subtask:', error);
    }
  };

  const handleOnBlur = () => {
    if (newTaskName.trim() === '') {
      setIsEdit(true);
      return;
    }

    addInstantTask(newTaskName);
  };

  const handleInputBlur = () => {
    if (newTaskName.trim() === '') {
      setIsEdit(false);
    } else {
      handleOnBlur();
    }
  };

  useEffect(() => {
    if (isEdit && !creatingTask && newTaskName === '') {
      const inputElement = document.querySelector('.subtask-table-input') as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
      }
    }
  }, [isEdit, creatingTask, newTaskName]);

  const handleEditSubTask = (taskId: string) => {
    if (!taskId || !projectId) return;

    // Close the current drawer and open the drawer for the selected sub task
    dispatch(setShowTaskDrawer(false));

    // Small delay to ensure the current drawer is closed before opening the new one
    setTimeout(() => {
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));

      // Fetch task data for the subtask
      dispatch(fetchTask({ taskId, projectId }));
    }, 100);
  };

  const getSubTasksProgress = () => {
    const ratio = taskFormViewModel?.task?.complete_ratio || 0;
    return ratio == Infinity ? 0 : ratio;
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
      },
      {
        key: 'priority',
        render: (record: IProjectTask) => (
          <Tag
            color={themeMode === 'dark' ? record.priority_color_dark : record.priority_color}
            style={{ textTransform: 'capitalize' }}
          >
            {record.priority_name}
          </Tag>
        ),
      },
      {
        key: 'status',
        render: (record: IProjectTask) => (
          <Tag
            color={themeMode === 'dark' ? record.status_color_dark : record.status_color}
            style={{ textTransform: 'capitalize' }}
          >
            {record.status_name}
          </Tag>
        ),
      },
      {
        key: 'assignee',
        render: (record: ISubTask) => <Avatars members={record.names || []} />,
      },
      {
        key: 'actionBtns',
        width: 80,
        render: (record: IProjectTask) => (
          <Flex gap={8} align="center" className="action-buttons">
            <Tooltip title={typeof t === 'function' ? t('taskInfoTab.subTasks.edit') : 'Edit'}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => record.id && handleEditSubTask(record.id)}
              />
            </Tooltip>
            <Popconfirm
              title="Are you sure?"
              icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
              okText="Yes"
              cancelText="No"
              onPopupClick={e => e.stopPropagation()}
              onConfirm={e => {
                handleDeleteSubTask(record.id);
              }}
            >
              <Tooltip title="Delete">
                <Button
                  shape="default"
                  icon={<DeleteOutlined />}
                  size="small"
                  onClick={e => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          </Flex>
        ),
      },
    ],
    [themeMode, t]
  );

  return (
    <Flex vertical gap={12}>
      {taskFormViewModel?.task?.sub_tasks && <Progress percent={getSubTasksProgress()} />}

      <Flex vertical gap={6}>
        {subTasks.length > 0 && (
          <Table
            className="custom-two-colors-row-table subtask-table"
            showHeader={false}
            dataSource={subTasks}
            columns={columns}
            rowKey={record => record?.id || nanoid()}
            pagination={{ hideOnSinglePage: true }}
            onRow={record => ({
              style: {
                cursor: 'pointer',
                height: 36,
              },
              onClick: () => record.id && handleEditSubTask(record.id),
            })}
            loading={loadingSubTasks}
          />
        )}

        <div>
          {isEdit ? (
            <Input
              autoFocus
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              style={{
                border: 'none',
                boxShadow: 'none',
                height: 38,
              }}
              placeholder={
                typeof t === 'function'
                  ? t('taskInfoTab.subTasks.addSubTaskInputPlaceholder')
                  : 'Type your task and hit enter'
              }
              onBlur={handleInputBlur}
              onPressEnter={handleOnBlur}
              size="small"
              className="subtask-table-input"
            />
          ) : (
            <Input
              onFocus={() => setIsEdit(true)}
              value={t('taskInfoTab.subTasks.addSubTask')}
              className={`border-none ${themeMode === 'dark' ? 'hover:bg-[#343a40]' : 'hover:bg-[#edebf0]'} hover:text-[#1890ff]`}
              readOnly
            />
          )}
        </div>
      </Flex>
    </Flex>
  );
};

export default SubTaskTable;
