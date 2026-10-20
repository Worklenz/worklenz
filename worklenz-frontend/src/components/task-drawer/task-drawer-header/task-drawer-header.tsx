import {
  Button,
  Dropdown,
  Flex,
  notification,
  Tooltip,
} from '@/shared/antd-imports';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  EllipsisOutlined,
  CopyOutlined,
  DeleteOutlined,
} from '@/shared/antd-imports';
import { TFunction } from 'i18next';

import './task-drawer-header.css';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import TaskDrawerStatusDropdown from '../task-drawer-status-dropdown/task-drawer-status-dropdown';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  navigateToNextTask,
  navigateToPreviousTask,
  fetchTask,
  syncNavigationIndex,
  setLastDeletedTaskId,
} from '@/features/task-drawer/task-drawer.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import useTaskDrawerUrlSync from '@/hooks/useTaskDrawerUrlSync';
import { deleteTask } from '@/features/tasks/tasks.slice';
import {
  deleteTask as deleteTaskFromManagement,
  fetchTasksV3,
} from '@/features/task-management/task-management.slice';
import { deselectTask } from '@/features/task-management/selection.slice';
import { deleteBoardTask } from '@/features/board/board-slice';
import {
  deleteTask as deleteKanbanTask,
  updateEnhancedKanbanSubtask,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { ITaskViewModel } from '@/types/tasks/task.types';
import TaskDrawerNavigation from '../task-drawer-navigation/task-drawer-navigation';
import { TaskDrawerIssueIdentity } from './task-drawer-issue-identity';
import { useTaskDrawerStatuses } from '@/hooks/useTaskDrawerStatuses';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import logger from '@/utils/errorLogger';
import homePageApi from '@/api/home-page/home-page.api.service';
import CopyTaskToProjectModal from '@/components/task-list-v2/components/CopyTaskToProjectModal';
import { duplicateTask } from '@/features/task-management/task-management.slice';
import taskDuplicateApiService from '@/api/tasks/task-duplicate.api.service';
import { StickyTaskName } from './sticky-task-name';

type TaskDrawerHeaderProps = {
  t: TFunction;
  canCreateTask?: boolean;
  isGuest?: boolean;
};

const TaskDrawerHeader = ({ t, canCreateTask, isGuest = false }: TaskDrawerHeaderProps) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { t: tDuplicate } = useTranslation('task-duplicate');
  const { socket } = useSocket();
  const { clearTaskFromUrl } = useTaskDrawerUrlSync();
  const isDeleting = useRef(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copyToProjectOpen, setCopyToProjectOpen] = useState(false);
  const [copyToProjectLoading, setCopyToProjectLoading] = useState(false);

  const {
    taskFormViewModel,
    selectedTaskId,
    navigationContext,
  } = useAppSelector(state => state.taskDrawerReducer);

  const statusesForDropdown = useTaskDrawerStatuses();
  const isSoftwareProject = useAppSelector(state =>
    isSoftwareProjectType(state.projectReducer.project?.project_type)
  );

  const currentSession = useAuthService().getCurrentSession();

  const isSubTask =
    taskFormViewModel?.task?.is_sub_task ||
    !!taskFormViewModel?.task?.parent_task_id;

  const sourceProjectId =
    taskFormViewModel?.task?.project_id || navigationContext?.projectId;

  useEffect(() => {
    if (selectedTaskId && navigationContext) {
      dispatch(syncNavigationIndex());
    }
  }, [selectedTaskId, dispatch, navigationContext]);

  const handleCopyTaskLink = async () => {
    if (!selectedTaskId) return;

    try {
      const taskLink = `${window.location.origin}/worklenz/t/${selectedTaskId}`;

      await navigator.clipboard.writeText(taskLink);

      notification.success({
        message: t('Link copied to clipboard') || 'Task link copied to clipboard',
      });
    } catch (error) {
      logger.error('Error copying task link:', error);

      notification.error({
        message: t('Failed to copy task link') || 'Failed to copy task link',
      });
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskId || isDeleting.current) return;

    isDeleting.current = true;
    setDropdownOpen(false);
    setShowDeleteConfirm(false);

    let res: Awaited<ReturnType<typeof tasksApiService.deleteTask>>;
    try {
      res = await tasksApiService.deleteTask(selectedTaskId);
    } catch (error) {
      logger.error('Error deleting task:', error);
      isDeleting.current = false;
      return;
    }

    if (res.done) {
      dispatch(setLastDeletedTaskId(selectedTaskId));
      dispatch(deleteTask({ taskId: selectedTaskId }));
      dispatch(deleteTaskFromManagement(selectedTaskId));
      dispatch(deselectTask(selectedTaskId));
      dispatch(deleteBoardTask({ sectionId: '', taskId: selectedTaskId }));

      dispatch(setSelectedTaskId(null));

      dispatch(deleteTask({ taskId: selectedTaskId }));
      dispatch(deleteBoardTask({ sectionId: '', taskId: selectedTaskId }));

      if (taskFormViewModel?.task?.is_sub_task) {
        dispatch(
          updateEnhancedKanbanSubtask({
            sectionId: '',
            subtask: {
              id: selectedTaskId,
              parent_task_id:
                taskFormViewModel?.task?.parent_task_id || '',
              manual_progress: false,
            },
            mode: 'delete',
          })
        );
      } else {
        dispatch(deleteKanbanTask(selectedTaskId));
      }

      // Invalidate home page cache to refresh the task list
      dispatch(homePageApi.util.invalidateTags(['myTasks', 'taskCounts']));

      dispatch(setShowTaskDrawer(false));

      setTimeout(() => {
        clearTaskFromUrl();
        isDeleting.current = false;
      }, 100);

      if (taskFormViewModel?.task?.parent_task_id) {
        socket?.emit(
          SocketEvents.GET_TASK_PROGRESS.toString(),
          taskFormViewModel?.task?.parent_task_id
        );
      }
    } else {
      isDeleting.current = false;
    }
  };                 

  const renderPopup = () => {
    return (
      <div
        style={{
          background: 'var(--ant-color-bg-elevated)',
          borderRadius: 'var(--ant-border-radius-lg)',
          boxShadow: 'var(--ant-box-shadow-secondary)',
          padding: '4px 0',
          minWidth: '200px',
        }}
      >
        {/* Copy link item */}
        <div
          className="task-drawer-dropdown-item task-drawer-dropdown-item--default"
          onClick={() => {
            handleCopyTaskLink();
            setDropdownOpen(false);
          }}
        >
          <CopyOutlined />
          {t('Copy link to task') || 'Copy link to task'}
        </div>

        {canCreateTask && !isGuest && sourceProjectId && selectedTaskId && (
          <Tooltip
            title={taskFormViewModel?.task?.is_sub_task ? t('copyToProject.subtaskTooltip', { defaultValue: 'Only main tasks can be copied to other projects' }) : ''}
            placement="top"
          >
            <div
              className={`task-drawer-dropdown-item task-drawer-dropdown-item--default ${
                taskFormViewModel?.task?.is_sub_task ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => {
                if (!taskFormViewModel?.task?.is_sub_task) {
                  setDropdownOpen(false);
                  setCopyToProjectOpen(true);
                }
              }}
            >
              <CopyOutlined />
              {tDuplicate('copyToProject.title', { defaultValue: 'Copy to project' })}
            </div>
          </Tooltip>
        )}

        {/* Delete Task item */}
        {canCreateTask && !isGuest && (
          <div
            className="task-drawer-dropdown-item task-drawer-dropdown-item--danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <DeleteOutlined />
            {t('taskHeader.deleteTask') || 'Delete Task'}
          </div>
        )}

        {/* Confirmation */}
        {canCreateTask && !isGuest && showDeleteConfirm && (
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid var(--ant-color-split)',
            }}
          >
            <p
              style={{
                margin: '0 0 8px 0',
                fontSize: '12px',
                color: 'var(--ant-color-text-secondary)',
              }}
            >
              {t('taskHeader.deleteTaskConfirmMessage', {
                defaultValue: 'Are you sure?',
              })}
            </p>

            <Flex gap={8}>
              <Button
                size="small"
                danger
                type="primary"
                className="task-delete-confirm-btn"
                style={{ flex: 1 }}
                onClick={e => {
                  e.stopPropagation();
                  handleDeleteTask();
                }}
              >
                {t('taskHeader.deleteConfirmOk', {
                  defaultValue: 'Yes',
                })}
              </Button>

              <Button
                size="small"
                style={{ flex: 1 }}
                onClick={e => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
              >
                {t('taskHeader.deleteConfirmCancel', {
                  defaultValue: 'No',
                })}
              </Button>
            </Flex>
          </div>
        )}
      </div>
    );
  };

  const handlePrevious = () => {
    if (!navigationContext) return;

    dispatch(navigateToPreviousTask());

    const prevTaskId =
      navigationContext.taskIds[
        navigationContext.currentIndex - 1
      ];

    if (prevTaskId && navigationContext.projectId) {
      dispatch(
        fetchTask({
          taskId: prevTaskId,
          projectId: navigationContext.projectId,
        })
      );
    }
  };

  const handleNext = () => {
    if (!navigationContext) return;

    dispatch(navigateToNextTask());

    const nextTaskId =
      navigationContext.taskIds[
        navigationContext.currentIndex + 1
      ];

    if (nextTaskId && navigationContext.projectId) {
      dispatch(
        fetchTask({
          taskId: nextTaskId,
          projectId: navigationContext.projectId,
        })
      );
    }
  };

  return (
    <Flex
      align="center"
      justify="space-between"
      style={{ width: '100%', gap: 12 }}
    >
      {isSoftwareProject ? (
        <TaskDrawerIssueIdentity
          taskKey={taskFormViewModel?.task?.task_key}
          issueType={taskFormViewModel?.task?.issue_type}
          isSubTask={isSubTask}
        />
      ) : (
        <div />
      )}

      <Flex gap={6} align="center" style={{ flexShrink: 0 }}>
        {!isSubTask &&
          navigationContext &&
          navigationContext.taskIds.length > 1 && (
            <TaskDrawerNavigation
              onPrevious={handlePrevious}
              onNext={handleNext}
              hasPrevious={navigationContext.currentIndex > 0}
              hasNext={
                navigationContext.currentIndex <
                navigationContext.taskIds.length - 1
              }
              currentIndex={navigationContext.currentIndex}
              totalTasks={navigationContext.taskIds.length}
            />
          )}

        {!isSoftwareProject && (
          <TaskDrawerStatusDropdown
            statuses={statusesForDropdown}
            task={
              taskFormViewModel?.task ??
              ({} as ITaskViewModel)
            }
            teamId={currentSession?.team_id ?? ''}
            disabled={isGuest}
          />
        )}

        <Dropdown
          overlayClassName={'task-drawer-actions-dropdown'}
          placement="bottomRight"
          trigger={['click']}
          open={dropdownOpen}
          onOpenChange={open => {
            setDropdownOpen(open);

            if (!open) {
              setShowDeleteConfirm(false);
            }
          }}
          popupRender={renderPopup}
        >
          <Button
            type="text"
            icon={
              <EllipsisOutlined style={{ fontSize: '24px' }} />
            }
          />
        </Dropdown>
      </Flex>

      <CopyTaskToProjectModal
        open={copyToProjectOpen}
        sourceProjectId={sourceProjectId ?? undefined}
        taskTitle={taskFormViewModel?.task?.name}
        hasDependencies={taskFormViewModel?.task?.has_dependencies || false}
        confirmLoading={copyToProjectLoading}
        onCompare={async destinationProjectId => {
          const response = await taskDuplicateApiService.compare({
            task_id: selectedTaskId as string,
            project_id: sourceProjectId as string,
            destination_project_id: destinationProjectId,
          });
          return response.body;
        }}
        onClose={() => setCopyToProjectOpen(false)}
        onConfirm={async (destinationProjectId, confirmedDifferences, includeDependencies) => {
          if (!selectedTaskId || !sourceProjectId) return;

          setCopyToProjectLoading(true);
          try {
            const response = await dispatch(
              duplicateTask({
                taskId: selectedTaskId,
                projectId: sourceProjectId,
                destinationProjectId,
                confirmProjectDifferences: confirmedDifferences,
                duplicateOptions: {
                  subtasks: true,
                  attachments: true,
                  dates: true,
                  dependencies: includeDependencies,
                  assignees: true,
                  labels: true,
                  customFields: true,
                  subscribers: true,
                },
              })
            ).unwrap();

            if (response.done) {
              const copiedTaskId = response.body?.id;
              notification.success({
                message: tDuplicate('copyToProject.success', {
                  defaultValue: 'Task copied successfully',
                }),
                btn: copiedTaskId ? (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => navigate(`/worklenz/t/${copiedTaskId}`)}
                  >
                    {tDuplicate('copyToProject.openTask', { defaultValue: 'Open task' })}
                  </Button>
                ) : undefined,
              });
              setCopyToProjectOpen(false);
            }
          } catch (error) {
            logger.error('Failed to copy task to project:', error);
            notification.error({
              message: tDuplicate('copyToProject.error', {
                defaultValue: 'Failed to copy task',
              }),
              description: typeof error === 'string' ? error : undefined,
            });
          } finally {
            setCopyToProjectLoading(false);
          }
        }}
      />
    </Flex>
  );
};

export default React.memo(TaskDrawerHeader);
