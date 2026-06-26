import {
  Collapse,
  CollapseProps,
  Flex,
  Skeleton,
  Typography,
} from '@/shared/antd-imports';
import React, { useEffect, useState, useRef } from 'react';
import { InboxOutlined } from '@ant-design/icons';
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
import TaskDrawerCustomFields from './details/task-drawer-custom-fields/task-drawer-custom-fields';
import { hasDrawerSupportedCustomFields } from '@/utils/task-custom-columns';
import { useAuthService } from '@/hooks/useAuth';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { useAppSumoTracking } from '@/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';

interface TaskDrawerInfoTabProps {
  t: TFunction;
  canCreateTask?: boolean;
}

const TaskDrawerInfoTab = ({ t, canCreateTask }: TaskDrawerInfoTabProps) => {
  const FREE_ATTACHMENT_SIZE_LIMIT_MB = 25;
  const BUSINESS_ATTACHMENT_SIZE_LIMIT_MB = 250;
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const { hasBusinessAccess } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');
  const attachmentSizeLimitMb = hasBusinessAccess
    ? BUSINESS_ATTACHMENT_SIZE_LIMIT_MB
    : FREE_ATTACHMENT_SIZE_LIMIT_MB;
  const attachmentSizeLimitBytes = attachmentSizeLimitMb * 1024 * 1024;

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

  // Tab-level drag-and-drop state
  const [isTabDragOver, setIsTabDragOver] = useState(false);
  // dragCounter tracks nested dragenter/dragleave events so the overlay
  // doesn't flicker when the cursor moves over child elements.
  const dragCounterRef = useRef(0);

  // Controlled collapse keys so we can auto-expand attachments on drop
  const defaultCollapseKeys = ['details', 'description', 'subTasks', 'dependencies', 'attachments', 'comments'];
  const [collapseActiveKeys, setCollapseActiveKeys] = useState<string[]>(defaultCollapseKeys);

  // FIX: Track the previous task ID so we only re-fetch when a REAL task is
  // opened (selectedTaskId is a non-null string), not when the drawer closes
  // and resets selectedTaskId to null. Without this guard, closing the drawer
  // triggers the useEffect cleanup (which wipes local state) and then
  // immediately re-runs fetchTaskData with null — causing a redundant API call
  // and leaving taskFormViewModel empty when the drawer reopens.
  const prevTaskIdRef = useRef<string | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    if (!taskFormViewModel?.task?.id || !projectId) return;

    const oversizedFiles = files.filter(file => file.size > attachmentSizeLimitBytes);
    if (oversizedFiles.length > 0) {
      if (!hasBusinessAccess) {
        if (isAppSumoUser) {
          trackAppSumoEvent(AppSumoUpsellEvents.OVERSIZED_FILE_BLOCKED, {
            feature: 'task_attachments',
            file_count: oversizedFiles.length,
          });
        }
        promptUpgrade();
      }
      return;
    }

    if (!processingUpload) {
      setProcessingUpload(true);

      try {
        const filesToUpload = [...files];
        selectedFilesRef.current = filesToUpload;

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
        fetchTaskAttachments();
      }
    }
  };

  // Tab-level drag handlers
  const handleTabDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsTabDragOver(true);
    }
  };

  const handleTabDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // required to allow drop
  };

  const handleTabDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsTabDragOver(false);
    }
  };

  const handleTabDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsTabDragOver(false);

    if (loadingTask || processingUpload) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Auto-expand the attachments panel if it is currently collapsed
    setCollapseActiveKeys(prev =>
      prev.includes('attachments') ? prev : [...prev, 'attachments']
    );

    handleFilesSelected(files);
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

  const hasSupportedCustomFields = hasDrawerSupportedCustomFields(
    taskFormViewModel?.custom_columns || []
  );

  const allInfoItems: CollapseProps['items'] = [
    {
      key: 'details',
      label: <Typography.Text strong>{t('taskInfoTab.details.title')}</Typography.Text>,
      children: <TaskDetailsForm taskFormViewModel={taskFormViewModel} />,
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    ...(hasSupportedCustomFields
      ? [
          {
            key: 'customFields',
            label: <Typography.Text strong>{t('taskInfoTab.customFields.title')}</Typography.Text>,
            children: (
              <TaskDrawerCustomFields
                customColumns={taskFormViewModel?.custom_columns || []}
                projectId={projectId || null}
                task={(taskFormViewModel?.task as ITaskViewModel) || null}
                teamMembers={taskFormViewModel?.team_members || []}
              />
            ),
            style: panelStyle,
            className: 'custom-task-drawer-info-collapse',
          },
        ]
      : []),
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
      children: (
        <SubTaskTable
          subTasks={subTasks}
          loadingSubTasks={loadingSubTasks}
          refreshSubTasks={() => fetchSubTasks()}
          canCreateTask={canCreateTask}
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
          task={(taskFormViewModel?.task as ITaskViewModel) || ({} as ITaskViewModel)}
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
            onUpgradeRequested={() => {
              if (isAppSumoUser) {
                trackAppSumoEvent(AppSumoUpsellEvents.TASK_ATTACHMENT_UPGRADE_CLICKED, { feature: 'task_attachments' });
              }
              promptUpgrade();
            }}
            t={t}
            loadingTask={loadingTask}
            uploading={processingUpload}
            handleFilesSelected={handleFilesSelected}
            maxFileSizeMb={attachmentSizeLimitMb}
            showUpgradeLink={!hasBusinessAccess}
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
        dispatch(
          updateTaskCounts({
            taskId: selectedTaskId,
            counts: {
              has_dependencies: res.body.length > 0,
            },
          })
        );
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
        dispatch(
          updateTaskCounts({
            taskId: selectedTaskId,
            counts: {
              attachments_count: res.body.length,
            },
          })
        );
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
    // FIX: Only fetch and reset data when selectedTaskId changes to a REAL
    // task ID (non-null). When the drawer closes, resetTaskState() sets
    // selectedTaskId → null after a 300ms timeout. Without this guard, that
    // null change re-triggers this effect: the cleanup wipes all local state,
    // then fetchTaskData() runs with null and dispatches fetchTask(null),
    // which clears taskFormViewModel in Redux. So when the drawer reopens the
    // task, every field (phase, priority, labels, assignees, due date,
    // estimation) shows blank until the API round-trip completes again.
    if (!selectedTaskId) {
      // Reset the prevTaskIdRef when drawer closes
      prevTaskIdRef.current = null;
      return;
    }

    // Check if we need to fetch data:
    // 1. If it's a different task than before, OR
    // 2. If it's the same task but taskFormViewModel is empty (drawer was closed and reopened), OR
    // 3. If it's the same task but local state is empty (cleanup ran when drawer closed)
    const isDifferentTask = selectedTaskId !== prevTaskIdRef.current;
    const isDataMissing = !taskFormViewModel || !taskFormViewModel.task;
    const isLocalStateMissing =
      taskAttachments.length === 0 || subTasks.length === 0 || taskDependencies.length === 0;

    if (!isDifferentTask && !isDataMissing && !isLocalStateMissing) {
      // Same task and data is already loaded, skip fetch
      return;
    }

    prevTaskIdRef.current = selectedTaskId;

    fetchTaskData();
    fetchSubTasks();
    fetchTaskDependencies();
    fetchTaskAttachments();
    fetchTaskComments();

    return () => {
      // Only clear local data when we're actually switching to a different
      // task, not when selectedTaskId is being reset to null on drawer close.
      setSubTasks([]);
      setTaskDependencies([]);
      setTaskAttachments([]);
      selectedFilesRef.current = [];
      setTaskComments([]);
    };
  }, [selectedTaskId, projectId]);

  return (
    <Skeleton active loading={loadingTask}>
      <div
        className="task-drawer-info-tab-drop-zone"
        onDragEnter={handleTabDragEnter}
        onDragOver={handleTabDragOver}
        onDragLeave={handleTabDragLeave}
        onDrop={handleTabDrop}
      >
        {isTabDragOver && (
          <div className="task-drawer-info-tab-drop-overlay">
            <div className="task-drawer-info-tab-drop-overlay-content">
              <InboxOutlined className="task-drawer-info-tab-drop-icon" />
              <span>{t('taskInfoTab.attachments.dropFilesHere', { defaultValue: 'Drop files here to attach' })}</span>
            </div>
          </div>
        )}
        <Flex vertical>
          <Collapse
            items={infoItems}
            bordered={false}
            activeKey={collapseActiveKeys}
            onChange={keys => setCollapseActiveKeys(keys as string[])}
          />
        </Flex>
      </div>
    </Skeleton>
  );
};

export default TaskDrawerInfoTab;
