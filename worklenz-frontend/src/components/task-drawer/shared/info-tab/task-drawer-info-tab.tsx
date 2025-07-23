import { Button, Collapse, CollapseProps, Flex, Skeleton, Tooltip, Typography } from '@/shared/antd-imports';
import React, { useEffect, useState, useRef } from 'react';
import { ReloadOutlined } from '@/shared/antd-imports';
import DescriptionEditor from './description-editor';
import SubTaskTable from './subtask-table';
import DependenciesTable from './dependencies-table';
import { useAppSelector } from '@/hooks/useAppSelector';
import TaskDetailsForm from './task-details-form';
import { fetchTask } from '@/features/tasks/tasks.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateTaskCounts } from '@/features/task-management/task-management.slice';
import { TFunction } from 'i18next';
import { subTasksApiService } from '@/api/tasks/subtasks.api.service';
import { ISubTask } from '@/types/tasks/subTask.types';
import { ITaskDependency } from '@/types/tasks/task-dependency.types';
import { taskDependenciesApiService } from '@/api/tasks/task-dependencies.api.service';
import logger from '@/utils/errorLogger';
import { getBase64 } from '@/utils/file-utils';
import {
  ITaskAttachment,
  ITaskAttachmentViewModel,
} from '@/types/tasks/task-attachment-view-model';
import taskAttachmentsApiService from '@/api/tasks/task-attachments.api.service';
import AttachmentsGrid from './attachments/attachments-grid';
import TaskComments from './comments/task-comments';
import { ITaskCommentViewModel } from '@/types/tasks/task-comments.types';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import { ITaskViewModel } from '@/types/tasks/task.types';

interface TaskDrawerInfoTabProps {
  t: TFunction;
}

const TaskDrawerInfoTab = ({ t }: TaskDrawerInfoTabProps) => {
  const dispatch = useAppDispatch();

  const { projectId } = useAppSelector(state => state.projectReducer);
  const { taskFormViewModel, loadingTask, selectedTaskId } = useAppSelector(
    state => state.taskDrawerReducer
  );
  const [subTasks, setSubTasks] = useState<ISubTask[]>([]);
  const [loadingSubTasks, setLoadingSubTasks] = useState<boolean>(false);

  const [taskDependencies, setTaskDependencies] = useState<ITaskDependency[]>([]);
  const [loadingTaskDependencies, setLoadingTaskDependencies] = useState<boolean>(false);

  const [processingUpload, setProcessingUpload] = useState(false);
  const selectedFilesRef = useRef<File[]>([]);

  const [taskAttachments, setTaskAttachments] = useState<ITaskAttachmentViewModel[]>([]);
  const [loadingTaskAttachments, setLoadingTaskAttachments] = useState<boolean>(false);

  const [taskComments, setTaskComments] = useState<ITaskCommentViewModel[]>([]);
  const [loadingTaskComments, setLoadingTaskComments] = useState<boolean>(false);

  const handleFilesSelected = async (files: File[]) => {
    if (!taskFormViewModel?.task?.id || !projectId) return;

    if (!processingUpload) {
      setProcessingUpload(true);

      try {
        const filesToUpload = [...files];
        selectedFilesRef.current = filesToUpload;

        // Upload all files and wait for all promises to complete
        await Promise.all(
          filesToUpload.map(async file => {
            const base64 = await getBase64(file);
            const body: ITaskAttachment = {
              file: base64 as string,
              file_name: file.name,
              task_id: taskFormViewModel?.task?.id || '',
              project_id: projectId,
              size: file.size,
            };
            await taskAttachmentsApiService.createTaskAttachment(body);
          })
        );
      } finally {
        setProcessingUpload(false);
        selectedFilesRef.current = [];
        // Refetch attachments after all uploads are complete
        fetchTaskAttachments();
      }
    }
  };

  const fetchTaskData = () => {
    if (!loadingTask && selectedTaskId && projectId) {
      dispatch(fetchTask({ taskId: selectedTaskId, projectId }));
    }
  };

  const panelStyle: React.CSSProperties = {
    border: 'none',
    paddingBlock: 0,
  };

  // Define all info items
  const allInfoItems: CollapseProps['items'] = [
    {
      key: 'details',
      label: <Typography.Text strong>{t('taskInfoTab.details.title')}</Typography.Text>,
      children: <TaskDetailsForm taskFormViewModel={taskFormViewModel} />,
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    {
      key: 'description',
      label: <Typography.Text strong>{t('taskInfoTab.description.title')}</Typography.Text>,
      children: (
        <DescriptionEditor
          description={taskFormViewModel?.task?.description || null}
          taskId={taskFormViewModel?.task?.id || ''}
          parentTaskId={taskFormViewModel?.task?.parent_task_id || ''}
        />
      ),
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    {
      key: 'subTasks',
      label: <Typography.Text strong>{t('taskInfoTab.subTasks.title')}</Typography.Text>,
      extra: (
        <Tooltip title={t('taskInfoTab.subTasks.refreshSubTasks')} trigger={'hover'}>
          <Button
            shape="circle"
            icon={<ReloadOutlined spin={loadingSubTasks} />}
            onClick={e => {
              e.stopPropagation(); // Prevent click from bubbling up
              fetchSubTasks();
            }}
          />
        </Tooltip>
      ),
      children: (
        <SubTaskTable
          subTasks={subTasks}
          loadingSubTasks={loadingSubTasks}
          refreshSubTasks={() => fetchSubTasks()}
          t={t}
        />
      ),
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    {
      key: 'dependencies',
      label: <Typography.Text strong>{t('taskInfoTab.dependencies.title')}</Typography.Text>,
      children: (
        <DependenciesTable
          task={(taskFormViewModel?.task as ITaskViewModel) || {} as ITaskViewModel}
          t={t}
          taskDependencies={taskDependencies}
          loadingTaskDependencies={loadingTaskDependencies}
          refreshTaskDependencies={() => fetchTaskDependencies()}
        />
      ),
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    {
      key: 'attachments',
      label: <Typography.Text strong>{t('taskInfoTab.attachments.title')}</Typography.Text>,
      children: (
        <Flex vertical gap={16}>
          <AttachmentsGrid
            attachments={taskAttachments}
            onDelete={() => fetchTaskAttachments()}
            onUpload={() => fetchTaskAttachments()}
            t={t}
            loadingTask={loadingTask}
            uploading={processingUpload}
            handleFilesSelected={handleFilesSelected}
          />
        </Flex>
      ),
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    {
      key: 'comments',
      label: <Typography.Text strong>{t('taskInfoTab.comments.title')}</Typography.Text>,
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
      children: <TaskComments taskId={selectedTaskId || ''} t={t} />,
    },
  ];

  // Filter out the 'subTasks' item if this task is more than level 2
  const infoItems =
    (taskFormViewModel?.task?.task_level ?? 0) >= 2
      ? allInfoItems.filter(item => item.key !== 'subTasks')
      : allInfoItems;

  const fetchSubTasks = async () => {
    if (!selectedTaskId || loadingSubTasks) return;
    try {
      setLoadingSubTasks(true);
      const res = await subTasksApiService.getSubTasks(selectedTaskId);
      if (res.done) {
        setSubTasks(res.body);
      }
    } catch (error) {
      logger.error('Error fetching sub tasks:', error);
    } finally {
      setLoadingSubTasks(false);
    }
  };

  const fetchTaskDependencies = async () => {
    if (!selectedTaskId || loadingTaskDependencies) return;
    try {
      setLoadingTaskDependencies(true);
      const res = await taskDependenciesApiService.getTaskDependencies(selectedTaskId);
      if (res.done) {
        setTaskDependencies(res.body);
        
        // Update Redux state with the current dependency status
        dispatch(updateTaskCounts({
          taskId: selectedTaskId,
          counts: {
            has_dependencies: res.body.length > 0
          }
        }));
      }
    } catch (error) {
      logger.error('Error fetching task dependencies:', error);
    } finally {
      setLoadingTaskDependencies(false);
    }
  };

  const fetchTaskAttachments = async () => {
    if (!selectedTaskId || loadingTaskAttachments) return;
    try {
      setLoadingTaskAttachments(true);
      const res = await taskAttachmentsApiService.getTaskAttachments(selectedTaskId);
      if (res.done) {
        setTaskAttachments(res.body);
        
        // Update Redux state with the current attachment count
        dispatch(updateTaskCounts({
          taskId: selectedTaskId,
          counts: {
            attachments_count: res.body.length
          }
        }));
      }
    } catch (error) {
      logger.error('Error fetching task attachments:', error);
    } finally {
      setLoadingTaskAttachments(false);
    }
  };

  const fetchTaskComments = async () => {
    if (!selectedTaskId || loadingTaskComments) return;
    try {
      setLoadingTaskComments(true);
      const res = await taskCommentsApiService.getByTaskId(selectedTaskId);
      if (res.done) {
        setTaskComments(res.body);
      }
    } catch (error) {
      logger.error('Error fetching task comments:', error);
    } finally {
      setLoadingTaskComments(false);
    }
  };

  useEffect(() => {
    fetchTaskData();
    fetchSubTasks();
    fetchTaskDependencies();
    fetchTaskAttachments();
    fetchTaskComments();

    return () => {
      setSubTasks([]);
      setTaskDependencies([]);
      setTaskAttachments([]);
      selectedFilesRef.current = [];
      setTaskComments([]);
    };
  }, [selectedTaskId, projectId]);

  return (
    <Skeleton active loading={loadingTask}>
      <Flex vertical>
        <Collapse
          items={infoItems}
          bordered={false}
          defaultActiveKey={[
            'details',
            'description',
            'subTasks',
            'dependencies',
            'attachments',
            'comments',
          ]}
        />
      </Flex>
    </Skeleton>
  );
};

export default TaskDrawerInfoTab;
