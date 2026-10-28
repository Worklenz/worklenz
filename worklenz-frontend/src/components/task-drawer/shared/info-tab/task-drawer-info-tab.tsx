import {
  Collapse,
  CollapseProps,
  Flex,
  message,
  Skeleton,
  Typography,
} from '@/shared/antd-imports';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { InboxOutlined } from '@ant-design/icons';
import DescriptionEditor from './description-editor';
import MentionedInDocs from './mentioned-in-docs';
import SubTaskTable from './subtask-table';
import DependenciesTable from './dependencies-table';
import { useAppSelector } from '@/hooks/useAppSelector';
import TaskDetailsForm from './task-details-form';
import { fetchTask } from '@/features/task-drawer/task-drawer.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
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
  IFileUploadState,
} from '@/types/tasks/task-attachment-view-model';
import taskAttachmentsApiService from '@/api/tasks/task-attachments.api.service';
import AttachmentsGrid from './attachments/attachments-grid';
import TaskComments from './comments/task-comments';
import { TaskAttachmentUploadItem } from './attachments/upload-progress';
import { ITaskViewModel } from '@/types/tasks/task.types';
import TaskDrawerCustomFields from './details/task-drawer-custom-fields/task-drawer-custom-fields';
import { hasDrawerSupportedCustomFields, getDrawerSupportedCustomFields } from '@/utils/task-custom-columns';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/utils/subscription-utils';
import { useAppSumoTracking } from '@/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import TaskDrawerDevelopment from './TaskDrawerDevelopment';

interface TaskDrawerInfoTabProps {
  t: TFunction;
  canCreateTask?: boolean;
  isGuest?: boolean;
}

const TaskDrawerInfoTab = ({ t, canCreateTask, isGuest }: TaskDrawerInfoTabProps) => {
  const FREE_ATTACHMENT_SIZE_LIMIT_MB = 25;
  const BUSINESS_ATTACHMENT_SIZE_LIMIT_MB = 250;
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');
  const attachmentSizeLimitMb = hasBusinessAccess
    ? BUSINESS_ATTACHMENT_SIZE_LIMIT_MB
    : FREE_ATTACHMENT_SIZE_LIMIT_MB;
  const attachmentSizeLimitBytes = attachmentSizeLimitMb * 1024 * 1024;

  const { projectId } = useAppSelector(state => state.projectReducer);
  const isSoftwareProject = useAppSelector(state =>
    isSoftwareProjectType(state.projectReducer.project?.project_type)
  );
  const { taskFormViewModel, loadingTask, selectedTaskId, targetCommentId, lastDeletedTaskId } = useAppSelector(
    state => state.taskDrawerReducer
  );
  const selectedTaskIdRef = useRef(selectedTaskId);
  selectedTaskIdRef.current = selectedTaskId;
  const lastDeletedTaskIdRef = useRef(lastDeletedTaskId);
  lastDeletedTaskIdRef.current = lastDeletedTaskId;
  const [subTasks, setSubTasks] = useState<ISubTask[]>([]);
  const [loadingSubTasks, setLoadingSubTasks] = useState<boolean>(false);

  const [taskDependencies, setTaskDependencies] = useState<ITaskDependency[]>([]);
  const [loadingTaskDependencies, setLoadingTaskDependencies] = useState<boolean>(false);

  const [processingUpload, setProcessingUpload] = useState(false);
  const selectedFilesRef = useRef<File[]>([]);

  // Track individual file upload progress
  const [pendingFiles, setPendingFiles] = useState<IFileUploadState[]>([]);
  const [uploadProgressItems, setUploadProgressItems] = useState<TaskAttachmentUploadItem[]>([]);

  const [taskAttachments, setTaskAttachments] = useState<ITaskAttachmentViewModel[]>([]);
  const [loadingTaskAttachments, setLoadingTaskAttachments] = useState<boolean>(false);

  // Tab-level drag-and-drop state
  const [isTabDragOver, setIsTabDragOver] = useState(false);
  // dragCounter tracks nested dragenter/dragleave events so the overlay
  // doesn't flicker when the cursor moves over child elements.
  const dragCounterRef = useRef(0);

  // Controlled collapse keys so we can auto-expand attachments on drop
  const defaultCollapseKeys = ['details', 'description', 'subTasks', 'dependencies', 'attachments', 'development', 'comments'];
  const [collapseActiveKeys, setCollapseActiveKeys] = useState<string[]>(defaultCollapseKeys);
  const [expandedCustomFieldsByTask, setExpandedCustomFieldsByTask] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!targetCommentId) return;
    setCollapseActiveKeys(previousKeys =>
      previousKeys.includes('comments') ? previousKeys : [...previousKeys, 'comments']
    );
  }, [targetCommentId]);

  // Keep the custom fields section expanded when fields exist or the user can add one.
  useEffect(() => {
    const supportedCustomFields = getDrawerSupportedCustomFields(
      taskFormViewModel?.custom_columns || []
    );
    const canShowEmptyCustomFieldsSection = !isGuest && canCreateTask;

    if (supportedCustomFields.length > 0 || canShowEmptyCustomFieldsSection) {
      setCollapseActiveKeys(prev =>
        prev.includes('customFields') ? prev : [...prev, 'customFields']
      );
    } else {
      setCollapseActiveKeys(prev =>
        prev.filter(key => key !== 'customFields')
      );
    }
  }, [canCreateTask, isGuest, taskFormViewModel?.custom_columns]);

  // FIX: Track the previous task ID so we only re-fetch when a REAL task is
  // opened (selectedTaskId is a non-null string), not when the drawer closes
  // and resets selectedTaskId to null. Without this guard, closing the drawer
  // triggers the useEffect cleanup (which wipes local state) and then
  // immediately re-runs fetchTaskData with null — causing a redundant API call
  // and leaving taskFormViewModel empty when the drawer reopens.
  const prevTaskIdRef = useRef<string | null>(null);

  const updatePendingFile = (uid: string, updater: (file: IFileUploadState) => IFileUploadState) => {
    setPendingFiles(prev => prev.map(file => (file.uid === uid ? updater(file) : file)));
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!taskFormViewModel?.task?.id || !projectId) return;

    // Reveal the attachments panel so pasted or dropped files are visible.
    setCollapseActiveKeys(prev =>
      prev.includes('attachments') ? prev : [...prev, 'attachments']
    );

    const oversizedFiles = files.filter(file => file.size > attachmentSizeLimitBytes);
    if (oversizedFiles.length > 0) {
      if (!hasBusinessAccess) {
        if (isAppSumoUser) {
          trackAppSumoEvent(AppSumoUpsellEvents.OVERSIZED_FILE_BLOCKED, {
            feature: 'task_attachments',
            file_count: oversizedFiles.length,
          });
        }
        dispatch(toggleUpgradeModal());
      } else {
        message.error(
          t('taskInfoTab.attachments.filesTooLarge', {
            defaultValue:
              'These files exceed the {{maxSize}}MB limit and were not added: {{names}}',
            maxSize: attachmentSizeLimitMb,
            names: oversizedFiles.map(file => file.name).join(', '),
          })
        );
      }
      return;
    }

    if (!processingUpload) {
      setProcessingUpload(true);

      try {
        const filesToUpload = [...files];
        selectedFilesRef.current = filesToUpload;

        // Create pending file records with unique IDs
        const newPendingFiles: IFileUploadState[] = filesToUpload.map((file, idx) => ({
          uid: `${Date.now()}-${idx}`,
          name: file.name,
          size: file.size,
          status: 'ready' as const,
          percent: 0,
        }));
        setPendingFiles(newPendingFiles);
        setUploadProgressItems(
          newPendingFiles.map(file => ({
            uid: file.uid,
            name: file.name,
            size: file.size,
            percent: file.percent,
            status: file.status,
          }))
        );

        // Upload each file using presigned URL flow (like project files)
        await Promise.all(
          filesToUpload.map(async (file, idx) => {
            const fileUid = newPendingFiles[idx].uid;
            try {
              updatePendingFile(fileUid, current => ({ ...current, status: 'uploading', percent: 0 }));
              setUploadProgressItems(prev => prev.map(item => item.uid === fileUid ? { ...item, status: 'uploading', percent: 0 } : item));

              // Step 1: Request presigned URL
              const presignResponse = await taskAttachmentsApiService.presignTaskAttachment(
                taskFormViewModel?.task?.id || '',
                projectId,
                file.name,
                file.size,
                file.type || 'application/octet-stream'
              );

              if (!presignResponse.done || !presignResponse.body) {
                throw new Error(presignResponse.message || 'Failed to initiate upload');
              }

              const { file_id, upload_url } = presignResponse.body;

              // Step 2: Upload file directly to storage with real progress tracking
              await taskAttachmentsApiService.uploadDirect(
                upload_url,
                file,
                percent => {
                  updatePendingFile(fileUid, current => ({ ...current, percent }));
                  setUploadProgressItems(prev => prev.map(item => item.uid === fileUid ? { ...item, percent, status: 'uploading' } : item));
                }
              );

              // Step 3: Confirm upload completion
              await taskAttachmentsApiService.confirmTaskAttachment(file_id, taskFormViewModel?.task?.id || '');

              updatePendingFile(fileUid, current => ({ ...current, status: 'done', percent: 100 }));
              setUploadProgressItems(prev => prev.map(item => item.uid === fileUid ? { ...item, status: 'done', percent: 100 } : item));
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : t('taskInfoTab.attachments.uploadFailed', { defaultValue: 'Upload failed' });
              updatePendingFile(fileUid, current => ({
                ...current,
                status: 'error',
                percent: undefined,
                errorMessage,
              }));
              setUploadProgressItems(prev => prev.map(item => item.uid === fileUid ? { ...item, status: 'error', percent: undefined, errorMessage } : item));
              logger.error('Error uploading file', error);
            }
          })
        );

        // Clear pending files after a short delay to show completion
        setTimeout(() => {
          setPendingFiles([]);
          setUploadProgressItems([]);
          setProcessingUpload(false);
          selectedFilesRef.current = [];
          fetchTaskAttachments();
        }, 1000);
      } catch (error) {
        logger.error('Error in handleFilesSelected:', error);
        setProcessingUpload(false);
        setPendingFiles([]);
        setUploadProgressItems([]);
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

  const fetchSubTasks = useCallback(async () => {
    if (!selectedTaskId || selectedTaskId === lastDeletedTaskId) return;
    const requestedTaskId = selectedTaskId;
    try {
      setLoadingSubTasks(true);
      const res = await subTasksApiService.getSubTasks(requestedTaskId);
      if (
        res.done &&
        selectedTaskIdRef.current === requestedTaskId &&
        lastDeletedTaskIdRef.current !== requestedTaskId
      ) {
        setSubTasks(res.body);
      }
    } catch (error) {
      logger.error('Error fetching sub tasks:', error);
    } finally {
      if (selectedTaskIdRef.current === requestedTaskId) {
        setLoadingSubTasks(false);
      }
    }
  }, [selectedTaskId, lastDeletedTaskId]);

  // ── Socket listener: keep drawer subtasks in sync with task list ──────────
  useEffect(() => {
    if (!socket || !selectedTaskId) return;

    // Subtask reorder completed — re-fetch to show the new order.
    const handleSubtaskReorderAck = (response: { done: boolean; parent_task_id?: string }) => {
      if (!response.done || !response.parent_task_id) return;
      if (response.parent_task_id !== selectedTaskId) return;
      fetchSubTasks();
    };

    // New subtask created from the task list — re-fetch so it appears
    // immediately in the drawer without requiring a page refresh.
    const handleQuickTask = (task: { id?: string; parent_task_id?: string }) => {
      if (!task?.parent_task_id) return;
      if (task.parent_task_id !== selectedTaskId) return;
      fetchSubTasks();
    };

    // Project updates (e.g., status renamed) — re-fetch subtasks to sync status names
    const handleProjectUpdatesAvailable = () => {
      if (!selectedTaskId || selectedTaskId === lastDeletedTaskId) return;
      fetchSubTasks();
    };

    socket.on(SocketEvents.SUBTASK_SORT_ORDER_CHANGE.toString(), handleSubtaskReorderAck);
    socket.on(SocketEvents.QUICK_TASK.toString(), handleQuickTask);
    socket.on(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleProjectUpdatesAvailable);
    return () => {
      socket.off(SocketEvents.SUBTASK_SORT_ORDER_CHANGE.toString(), handleSubtaskReorderAck);
      socket.off(SocketEvents.QUICK_TASK.toString(), handleQuickTask);
      socket.off(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleProjectUpdatesAvailable);
    };
  }, [socket, selectedTaskId, fetchSubTasks]);

  // GitHub activity (new PR/commit/branch or automated status change) for this task.
  const [githubRefreshToken, setGithubRefreshToken] = useState(0);
  useEffect(() => {
    if (!socket || !selectedTaskId || !isSoftwareProject) return;

    const handleGithubActivity = (payload: { task_ids?: string[] }) => {
      if (payload?.task_ids?.includes(selectedTaskId)) {
        setGithubRefreshToken(previous => previous + 1);
      }
    };

    socket.on(SocketEvents.GITHUB_TASK_ACTIVITY.toString(), handleGithubActivity);
    return () => {
      socket.off(SocketEvents.GITHUB_TASK_ACTIVITY.toString(), handleGithubActivity);
    };
  }, [socket, selectedTaskId, isSoftwareProject]);

  const fetchTaskDependencies = useCallback(async () => {
    if (!selectedTaskId || selectedTaskId === lastDeletedTaskId) return;
    const requestedTaskId = selectedTaskId;
    try {
      setLoadingTaskDependencies(true);
      const res = await taskDependenciesApiService.getTaskDependencies(requestedTaskId);
      if (
        res.done &&
        selectedTaskIdRef.current === requestedTaskId &&
        lastDeletedTaskIdRef.current !== requestedTaskId
      ) {
        setTaskDependencies(res.body);
        dispatch(
          updateTaskCounts({
            taskId: requestedTaskId,
            counts: { has_dependencies: res.body.length > 0 },
          })
        );
      }
    } catch (error) {
      logger.error('Error fetching task dependencies:', error);
    } finally {
      if (selectedTaskIdRef.current === requestedTaskId) {
        setLoadingTaskDependencies(false);
      }
    }
  }, [selectedTaskId, lastDeletedTaskId, dispatch]);

  const fetchTaskAttachments = useCallback(async () => {
    if (!selectedTaskId || selectedTaskId === lastDeletedTaskId) return;
    const requestedTaskId = selectedTaskId;
    try {
      setLoadingTaskAttachments(true);
      const res = await taskAttachmentsApiService.getTaskAttachments(requestedTaskId);
      if (
        res.done &&
        selectedTaskIdRef.current === requestedTaskId &&
        lastDeletedTaskIdRef.current !== requestedTaskId
      ) {
        setTaskAttachments(res.body);
        dispatch(
          updateTaskCounts({
            taskId: requestedTaskId,
            counts: { attachments_count: res.body.length },
          })
        );
      }
    } catch (error) {
      logger.error('Error fetching task attachments:', error);
    } finally {
      if (selectedTaskIdRef.current === requestedTaskId) {
        setLoadingTaskAttachments(false);
      }
    }
  }, [selectedTaskId, lastDeletedTaskId, dispatch]);

  // Keep drawer attachments in sync with socket updates (uploads/deletions)
  useEffect(() => {
    if (!socket || !selectedTaskId) return;

    const handleAttachmentsUpdated = (data: string | { task_id?: string }) => {
      const taskId = typeof data === 'string' ? data : data?.task_id;
      if (taskId === selectedTaskId) {
        fetchTaskAttachments();
      }
    };

    socket.on(SocketEvents.TASK_ATTACHMENTS_UPDATED.toString(), handleAttachmentsUpdated);
    return () => {
      socket.off(SocketEvents.TASK_ATTACHMENTS_UPDATED.toString(), handleAttachmentsUpdated);
    };
  }, [socket, selectedTaskId, fetchTaskAttachments]);

  const panelStyle: React.CSSProperties = {
    border: 'none',
    paddingBlock: 0,
  };

  const hasSupportedCustomFields = hasDrawerSupportedCustomFields(
    taskFormViewModel?.custom_columns || []
  );
  const shouldShowCustomFieldsSection = hasSupportedCustomFields || (!isGuest && canCreateTask);

  const allInfoItems: CollapseProps['items'] = [
    {
      key: 'details',
      label: <Typography.Text strong>{t('taskInfoTab.details.title', { defaultValue: 'Details' })}</Typography.Text>,
      children: <TaskDetailsForm taskFormViewModel={taskFormViewModel} canCreateTask={canCreateTask} isGuest={isGuest} />,
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    ...(shouldShowCustomFieldsSection
      ? [
          {
            key: 'customFields',
            label: <Typography.Text strong>{t('taskInfoTab.customFields.title', { defaultValue: 'Custom Fields' })}</Typography.Text>,
            children: (
              <TaskDrawerCustomFields
                customColumns={taskFormViewModel?.custom_columns || []}
                projectId={projectId || null}
                task={(taskFormViewModel?.task as ITaskViewModel) || null}
                teamMembers={taskFormViewModel?.team_members || []}
                isGuest={isGuest}
                canCreateTask={canCreateTask}
                isExpanded={Boolean(
                  taskFormViewModel?.task?.id && expandedCustomFieldsByTask[taskFormViewModel.task.id]
                )}
                onExpandedChange={isExpanded => {
                  const taskId = taskFormViewModel?.task?.id;
                  if (!taskId) return;
                  setExpandedCustomFieldsByTask(previous => ({
                    ...previous,
                    [taskId]: isExpanded,
                  }));
                }}
              />
            ),
            style: panelStyle,
            className: 'custom-task-drawer-info-collapse',
          },
        ]
      : []),
    {
      key: 'description',
      label: <Typography.Text strong>{t('taskInfoTab.description.title', { defaultValue: 'Description' })}</Typography.Text>,
      children: (
        <Flex vertical>
          <DescriptionEditor
            description={taskFormViewModel?.task?.description || null}
            taskId={taskFormViewModel?.task?.id || ''}
            parentTaskId={taskFormViewModel?.task?.parent_task_id || ''}
            projectId={projectId}
            isGuest={isGuest}
          />
          {selectedTaskId ? <MentionedInDocs taskId={selectedTaskId} isGuest={isGuest} /> : null}
        </Flex>
      ),
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    {
      key: 'subTasks',
      label: <Typography.Text strong>{t('taskInfoTab.subTasks.title', { defaultValue: 'Sub Tasks' })}</Typography.Text>,
      children: (
        <SubTaskTable
          subTasks={subTasks}
          loadingSubTasks={loadingSubTasks}
          refreshSubTasks={fetchSubTasks}
          canCreateTask={canCreateTask}
          isGuest={isGuest}
          t={t}
        />
      ),
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    {
      key: 'dependencies',
      label: <Typography.Text strong>{t('taskInfoTab.dependencies.title', { defaultValue: 'Dependencies' })}</Typography.Text>,
      children: (
        <DependenciesTable
          task={(taskFormViewModel?.task as ITaskViewModel) || ({} as ITaskViewModel)}
          t={t}
          taskDependencies={taskDependencies}
          loadingTaskDependencies={loadingTaskDependencies}
          refreshTaskDependencies={() => fetchTaskDependencies()}
          canCreateTask={canCreateTask}
          isGuest={isGuest}
        />
      ),
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    {
      key: 'attachments',
      label: <Typography.Text strong>{t('taskInfoTab.attachments.title', { defaultValue: 'Attachments' })}</Typography.Text>,
      children: isGuest ? (
        // For guests, show attachments in read-only mode (no upload controls)
        <Flex vertical gap={16}>
          <AttachmentsGrid
            attachments={taskAttachments}
            onUpload={() => fetchTaskAttachments()}
            onUpgradeRequested={() => {
              if (isAppSumoUser) {
                trackAppSumoEvent(AppSumoUpsellEvents.TASK_ATTACHMENT_UPGRADE_CLICKED, { feature: 'task_attachments' });
              }
              dispatch(toggleUpgradeModal());
            }}
            t={t}
            loadingTask={loadingTask}
            uploading={false}
            handleFilesSelected={() => {}} // Noop for guests
            maxFileSizeMb={attachmentSizeLimitMb}
            showUpgradeLink={false}
            uploadProgressItems={[]}
            isGuest={true}
          />
        </Flex>
      ) : (
        // For non-guests, show full upload functionality
        <Flex vertical gap={16}>
          <AttachmentsGrid
            attachments={taskAttachments}
            onDelete={() => fetchTaskAttachments()}
            onUpload={() => fetchTaskAttachments()}
            onUpgradeRequested={() => {
              if (isAppSumoUser) {
                trackAppSumoEvent(AppSumoUpsellEvents.TASK_ATTACHMENT_UPGRADE_CLICKED, { feature: 'task_attachments' });
              }
              dispatch(toggleUpgradeModal());
            }}
            t={t}
            loadingTask={loadingTask}
            uploading={processingUpload}
            handleFilesSelected={handleFilesSelected}
            maxFileSizeMb={attachmentSizeLimitMb}
            showUpgradeLink={!hasBusinessAccess}
            uploadProgressItems={uploadProgressItems}
          />
        </Flex>
      ),
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    {
      key: 'development',
      label: <Typography.Text strong>{t('taskInfoTab.development.title', { defaultValue: 'Development' })}</Typography.Text>,
      children: (
        <TaskDrawerDevelopment
          taskId={selectedTaskId || ''}
          taskKey={(taskFormViewModel?.task as ITaskViewModel | undefined)?.task_key}
          refreshToken={githubRefreshToken}
          canCreateBranch={canCreateTask && !isGuest}
          canRemoveLinks={canCreateTask && !isGuest}
        />
      ),
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
    },
    {
      key: 'comments',
      label: <Typography.Text strong>{t('taskInfoTab.comments.title', { defaultValue: 'Comments' })}</Typography.Text>,
      style: panelStyle,
      className: 'custom-task-drawer-info-collapse',
      children: <TaskComments taskId={selectedTaskId || ''} t={t} isGuest={isGuest} />,
    },
  ];

  // The Development (GitHub) section only applies to software projects.
  const scopedInfoItems = isSoftwareProject
    ? allInfoItems
    : allInfoItems.filter(item => item.key !== 'development');

  const levelInfoItems =
    (taskFormViewModel?.task?.task_level ?? 0) >= 2
      ? scopedInfoItems.filter(item => item.key !== 'subTasks')
      : scopedInfoItems;

  const infoItems = isSoftwareProject
    ? levelInfoItems
        .filter(item => SOFTWARE_SECTION_ORDER.includes(String(item.key)))
        .sort(
          (first, second) =>
            SOFTWARE_SECTION_ORDER.indexOf(String(first.key)) -
            SOFTWARE_SECTION_ORDER.indexOf(String(second.key))
        )
        .map(item => ({ ...item, label: <SoftwareSectionLabel>{item.label}</SoftwareSectionLabel> }))
    : levelInfoItems;

  useEffect(() => {
    if (!selectedTaskId || !projectId) {
      prevTaskIdRef.current = null;
      setSubTasks([]);
      setTaskDependencies([]);
      setTaskAttachments([]);
      selectedFilesRef.current = [];
      return;
    }

    const isDifferentTask = selectedTaskId !== prevTaskIdRef.current;
    prevTaskIdRef.current = selectedTaskId;

    if (isDifferentTask) {
      setSubTasks([]);
      setTaskDependencies([]);
      setTaskAttachments([]);
      selectedFilesRef.current = [];
    }

    fetchSubTasks();
    fetchTaskDependencies();
    fetchTaskAttachments();
  }, [selectedTaskId, projectId, fetchSubTasks, fetchTaskDependencies, fetchTaskAttachments]);

  useEffect(() => {
    if (!selectedTaskId || !projectId || loadingTask) return;

    const isDifferentTask = selectedTaskId !== taskFormViewModel?.task?.id;
    const hasIncompleteTaskData =
      isDifferentTask ||
      !taskFormViewModel?.task?.name ||
      (!taskFormViewModel?.task?.assignee_names?.length && !!taskFormViewModel?.task?.assignees?.length) ||
      (!taskFormViewModel?.task?.names?.length && !!taskFormViewModel?.task?.assignees?.length);

    if (hasIncompleteTaskData) {
      dispatch(fetchTask({ taskId: selectedTaskId, projectId }));
    }
  }, [
    selectedTaskId,
    projectId,
    loadingTask,
    taskFormViewModel?.task?.id,
    taskFormViewModel?.task?.name,
    taskFormViewModel?.task?.assignees,
    taskFormViewModel?.task?.assignee_names,
    taskFormViewModel?.task?.names,
    dispatch,
  ]);

  return (
    <Skeleton active loading={loadingTask}>
      <div
        className="task-drawer-info-tab-drop-zone"
        onDragEnter={isSoftwareProject ? undefined : handleTabDragEnter}
        onDragOver={isSoftwareProject ? undefined : handleTabDragOver}
        onDragLeave={isSoftwareProject ? undefined : handleTabDragLeave}
        onDrop={isSoftwareProject ? undefined : handleTabDrop}
      >
        {isTabDragOver && (
          <div className="task-drawer-info-tab-drop-overlay">
            <div className="task-drawer-info-tab-drop-overlay-content">
              <InboxOutlined className="task-drawer-info-tab-drop-icon" />
              <span>{t('taskInfoTab.attachments.dropFilesHere', { defaultValue: 'Drop files here to attach' })}</span>
            </div>
          </div>
        )}
        <Collapse
          items={infoItems}
          bordered={false}
          activeKey={collapseActiveKeys}
          onChange={keys => setCollapseActiveKeys(keys as string[])}
        />
      </div>
    </Skeleton>
  );
};

/** Sections shown in the software issue drawer, in display order. */
const SOFTWARE_SECTION_ORDER = ['description', 'details', 'development', 'comments'];

/** Small uppercase section heading used by the software issue drawer. */
const SoftwareSectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="uppercase tracking-wide text-xs opacity-70">{children}</span>
);

export default TaskDrawerInfoTab;
