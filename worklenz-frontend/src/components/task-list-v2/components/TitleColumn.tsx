import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import {
  RightOutlined,
  DoubleRightOutlined,
  ArrowsAltOutlined,
  CommentOutlined,
  EyeOutlined,
  PaperClipOutlined,
  MinusCircleOutlined,
  RetweetOutlined,
} from '@/shared/antd-imports';
import { Input, Tooltip } from '@/shared/antd-imports';
import type { InputRef } from '@/shared/antd-imports';
import { createPortal } from 'react-dom';
import { Task } from '@/types/task-management.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  toggleTaskExpansion,
  fetchSubTasks,
  selectGroups,
} from '@/features/task-management/task-management.slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchTask as fetchTaskDrawer,
  setNavigationContext,
  setSelectedTaskId,
  setShowTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';
import { useTranslation } from 'react-i18next';
import { getTaskDisplayName } from './TaskRowColumns';
import TaskContextMenu from './TaskContextMenu';

interface TitleColumnProps {
  width: string;
  task: Task;
  projectId: string;
  isSubtask: boolean;
  taskDisplayName: string;
  editTaskName: boolean;
  taskName: string;
  onEditTaskName: (editing: boolean) => void;
  onTaskNameChange: (name: string) => void;
  onTaskNameSave: () => void;
  onCancelEdit: () => void;
  depth?: number;
  canCreateTask?: boolean;
}

export const TitleColumn: React.FC<TitleColumnProps> = memo(
  ({
    width,
    task,
    projectId,
    isSubtask,
    taskDisplayName,
    editTaskName,
    taskName,
    onEditTaskName,
    onTaskNameChange,
    onTaskNameSave,
    onCancelEdit,
    depth = 0,
    canCreateTask = true,
  }) => {
    const dispatch = useAppDispatch();
    const { t } = useTranslation('task-list-table');
    const inputRef = useRef<InputRef>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const groups = useAppSelector(selectGroups);
    const { showTaskDrawer, selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);

    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

    const handleToggleExpansion = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (task.is_parent_container) {
          dispatch(toggleTaskExpansion(task.id));
          return;
        }
        if (!task.show_sub_tasks && (!task.sub_tasks || task.sub_tasks.length === 0)) {
          dispatch(
            fetchSubTasks({
              taskId: task.id,
              projectId,
              parentTaskIdForQuery: task.parent_task_container_id || task.id,
            })
          );
        }
        dispatch(toggleTaskExpansion(task.id));
      },
      [
        dispatch,
        task.id,
        task.sub_tasks,
        task.show_sub_tasks,
        task.is_parent_container,
        task.parent_task_container_id,
        projectId,
      ]
    );

    const handleTaskNameSave = useCallback(() => {
      // Delegate entirely to the parent hook (useTaskRowActions) which owns
      // the socket ref, connected ref, and originalTaskNameRef comparison.
      // The old local implementation was broken: it compared against task.title
      // which is already updated live by handleTaskNameChangeLive, making the
      // comparison always equal and silently skipping the socket emit.
      onTaskNameSave();
    }, [onTaskNameSave]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setContextMenuVisible(true);
    }, []);

    const handleContextMenuClose = useCallback(() => {
      setContextMenuVisible(false);
    }, []);

    const handleOpenTaskInDrawer = useCallback(() => {
      if (!task.id) return;
      if (showTaskDrawer && selectedTaskId === task.id) return;

      const taskIds = groups.flatMap(group => group.taskIds);
      const currentIndex = taskIds.indexOf(task.id);

      dispatch(
        setNavigationContext({
          taskIds,
          currentIndex: currentIndex >= 0 ? currentIndex : 0,
          sourceView: 'task-list',
          projectId,
        })
      );
      dispatch(setSelectedTaskId(task.id));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTaskDrawer({ taskId: task.id, projectId }));
    }, [dispatch, groups, projectId, selectedTaskId, showTaskDrawer, task.id]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
          handleTaskNameSave();
        }
      };

      if (editTaskName) {
        document.addEventListener('mousedown', handleClickOutside);
        inputRef.current?.focus();
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [editTaskName, handleTaskNameSave]);

    return (
      <div
        className="flex items-center group pl-1 border-r border-b border-t border-gray-200 dark:border-gray-700 overflow-hidden"
        style={{ width, height: '40px', minHeight: '40px' }}
        onClick={() => {
          if (showTaskDrawer && !editTaskName && !task.is_parent_container) {
            handleOpenTaskInDrawer();
          }
        }}
      >
        {editTaskName ? (
          <div className="flex-1" style={{ height: '40px' }} ref={wrapperRef}>
            <Input
              ref={inputRef}
              variant="borderless"
              value={taskName}
              onChange={e => onTaskNameChange(e.target.value)}
              autoFocus
              onPressEnter={handleTaskNameSave}
              onBlur={handleTaskNameSave}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelEdit();
                }
              }}
              className="text-sm"
              style={{
                width: '100%',
                height: '40px',
                margin: '0',
                padding: '8px 12px',
                border: '1px solid #1677ff',
                backgroundColor: 'rgba(22, 119, 255, 0.02)',
                borderRadius: '3px',
                fontSize: '14px',
                lineHeight: '22px',
                boxSizing: 'border-box',
                outline: 'none',
                boxShadow: '0 0 0 2px rgba(22, 119, 255, 0.1)',
              }}
            />
          </div>
        ) : (
          <>
            <div className="flex items-center flex-1 min-w-0 overflow-hidden">
              {isSubtask && <div className="w-2 flex-shrink-0" />}

              {Array.from({ length: depth }).map((_, i) => (
                <div key={i} className="w-6 flex-shrink-0" />
              ))}

              {depth < 2 && (
                <button
                  onClick={handleToggleExpansion}
                  className={`flex h-4 w-4 items-center justify-center rounded-sm text-xs mr-1 hover:border hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:scale-110 transition-all duration-300 ease-out flex-shrink-0 ${
                    task.sub_tasks_count != null && task.sub_tasks_count > 0
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <div
                    className="transition-transform duration-300 ease-out"
                    style={{
                      transform: task.show_sub_tasks ? 'rotate(90deg)' : 'rotate(0deg)',
                      transformOrigin: 'center',
                    }}
                  >
                    <RightOutlined className="text-gray-600 dark:text-gray-400" />
                  </div>
                </button>
              )}

              {isSubtask && <div className="w-1 flex-shrink-0" />}

              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex-1 min-w-0" ref={wrapperRef}>
                  <span
                    className="text-sm text-gray-700 dark:text-gray-300 truncate cursor-text block"
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (task.is_parent_container) return;
                      onEditTaskName(true);
                    }}
                    onContextMenu={e => {
                      if (task.is_parent_container) return;
                      handleContextMenu(e);
                    }}
                    title={taskDisplayName}
                  >
                    {taskDisplayName}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {depth < 2 && task.sub_tasks_count != null && task.sub_tasks_count > 0 && (
                    <Tooltip
                      title={t(
                        `indicators.tooltips.subtasks${task.sub_tasks_count === 1 ? '' : '_plural'}`,
                        { count: task.sub_tasks_count }
                      )}
                    >
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {task.sub_tasks_count}
                        </span>
                        <DoubleRightOutlined
                          className="text-blue-600 dark:text-blue-400"
                          style={{ fontSize: 10 }}
                        />
                      </div>
                    </Tooltip>
                  )}

                  {task.comments_count != null && task.comments_count !== 0 && (
                    <Tooltip
                      title={t(
                        `indicators.tooltips.comments${task.comments_count === 1 ? '' : '_plural'}`,
                        { count: task.comments_count }
                      )}
                    >
                      <CommentOutlined
                        className="text-gray-500 dark:text-gray-400"
                        style={{ fontSize: 12 }}
                      />
                    </Tooltip>
                  )}

                  {task.parent_task_not_archived && (
                    <Tooltip
                      title={t('activeParentTooltip', { defaultValue: 'Parent task is not archived' })}
                    >
                      <div className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-[11px] leading-4 text-gray-600 dark:text-gray-300">
                        {t('activeParentBadge', { defaultValue: 'Active parent' })}
                      </div>
                    </Tooltip>
                  )}

                  {task.has_subscribers && (
                    <Tooltip title={t('indicators.tooltips.subscribers')}>
                      <EyeOutlined
                        className="text-gray-500 dark:text-gray-400"
                        style={{ fontSize: 12 }}
                      />
                    </Tooltip>
                  )}

                  {task.attachments_count != null && task.attachments_count !== 0 && (
                    <Tooltip
                      title={t(
                        `indicators.tooltips.attachments${task.attachments_count === 1 ? '' : '_plural'}`,
                        { count: task.attachments_count }
                      )}
                    >
                      <PaperClipOutlined
                        className="text-gray-500 dark:text-gray-400"
                        style={{ fontSize: 12 }}
                      />
                    </Tooltip>
                  )}

                  {task.has_dependencies && (
                    <Tooltip title={t('indicators.tooltips.dependencies')}>
                      <MinusCircleOutlined
                        className="text-gray-500 dark:text-gray-400"
                        style={{ fontSize: 12 }}
                      />
                    </Tooltip>
                  )}

                  {task.schedule_id && (
                    <Tooltip title={t('indicators.tooltips.recurring')}>
                      <RetweetOutlined
                        className="text-gray-500 dark:text-gray-400"
                        style={{ fontSize: 12 }}
                      />
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>

            {/* Open button - inline so it pushes task name, not overlaps it */}
            <button
              className="pointer-events-none group-hover:pointer-events-auto focus-visible:pointer-events-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-solid border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer rounded-md shadow-sm hover:shadow-md flex items-center gap-1 flex-shrink-0 mr-2"
              onClick={e => {
                e.stopPropagation();
                handleOpenTaskInDrawer();
              }}
            >
              <ArrowsAltOutlined />
              {t('openButton')}
            </button>
          </>
        )}

        {contextMenuVisible &&
          createPortal(
            <TaskContextMenu
              task={task}
              projectId={projectId}
              position={contextMenuPosition}
              onClose={handleContextMenuClose}
              canCreateTask={canCreateTask}
            />,
            document.body
          )}
      </div>
    );
  }
);

TitleColumn.displayName = 'TitleColumn';
