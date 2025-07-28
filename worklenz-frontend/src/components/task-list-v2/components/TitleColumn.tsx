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
} from '@/features/task-management/task-management.slice';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
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
  depth?: number;
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
    depth = 0,
  }) => {
    const dispatch = useAppDispatch();
    const { socket, connected } = useSocket();
    const { t } = useTranslation('task-list-table');
    const inputRef = useRef<InputRef>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Context menu state
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

    // Handle task expansion toggle
    const handleToggleExpansion = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();

        // Always try to fetch subtasks when expanding, regardless of count
        if (!task.show_sub_tasks && (!task.sub_tasks || task.sub_tasks.length === 0)) {
          dispatch(fetchSubTasks({ taskId: task.id, projectId }));
        }

        // Toggle expansion state
        dispatch(toggleTaskExpansion(task.id));
      },
      [dispatch, task.id, task.sub_tasks, task.show_sub_tasks, projectId]
    );

    // Handle task name save
    const handleTaskNameSave = useCallback(() => {
      const newTaskName = inputRef.current?.input?.value || taskName;
      if (
        newTaskName?.trim() !== '' &&
        connected &&
        newTaskName.trim() !== (task.title || task.name || '').trim()
      ) {
        socket?.emit(
          SocketEvents.TASK_NAME_CHANGE.toString(),
          JSON.stringify({
            task_id: task.id,
            name: newTaskName.trim(),
            parent_task: task.parent_task_id,
          })
        );
      }
      onEditTaskName(false);
    }, [
      taskName,
      connected,
      socket,
      task.id,
      task.parent_task_id,
      task.title,
      task.name,
      onEditTaskName,
    ]);

    // Handle context menu
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Use clientX and clientY directly for fixed positioning
      setContextMenuPosition({
        x: e.clientX,
        y: e.clientY,
      });
      setContextMenuVisible(true);
    }, []);

    // Handle context menu close
    const handleContextMenuClose = useCallback(() => {
      setContextMenuVisible(false);
    }, []);

    // Handle click outside for task name editing
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
        className="flex items-center justify-between group pl-1 border-r border-gray-200 dark:border-gray-700"
        style={{ width }}
      >
        {editTaskName ? (
          /* Full cell input when editing */
          <div className="flex-1" style={{ height: '38px' }} ref={wrapperRef}>
            <Input
              ref={inputRef}
              variant="borderless"
              value={taskName}
              onChange={e => onTaskNameChange(e.target.value)}
              autoFocus
              onPressEnter={handleTaskNameSave}
              onBlur={handleTaskNameSave}
              className="text-sm"
              style={{
                width: '100%',
                height: '38px',
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
          /* Normal layout when not editing */
          <>
            <div className="flex items-center flex-1 min-w-0">
              {/* Indentation for subtasks - reduced spacing for level 1 */}
              {isSubtask && <div className="w-2 flex-shrink-0" />}

              {/* Additional indentation for deeper levels - increased spacing for level 2+ */}
              {Array.from({ length: depth }).map((_, i) => (
                <div key={i} className="w-6 flex-shrink-0" />
              ))}

              {/* Expand/Collapse button - show for any task that can have sub-tasks */}
              {depth < 2 && ( // Only show if not at maximum depth (can still have children)
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

              {/* Additional indentation for subtasks after the expand button space - reduced for level 1 */}
              {isSubtask && <div className="w-1 flex-shrink-0" />}

              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Task name with dynamic width */}
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
                      onEditTaskName(true);
                    }}
                    onContextMenu={handleContextMenu}
                    title={taskDisplayName}
                  >
                    {taskDisplayName}
                  </span>
                </div>

                {/* Indicators container - flex-shrink-0 to prevent compression */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Subtask count indicator - show for any task that can have sub-tasks */}
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

                  {/* Task indicators - compact layout */}
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

            <button
              className="opacity-0 group-hover:opacity-100 transition-all duration-200 ml-2 mr-2 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer rounded-md shadow-sm hover:shadow-md flex items-center gap-1 flex-shrink-0"
              onClick={e => {
                e.stopPropagation();
                dispatch(setSelectedTaskId(task.id));
                dispatch(setShowTaskDrawer(true));
              }}
            >
              <ArrowsAltOutlined />
              {t('openButton')}
            </button>
          </>
        )}

        {/* Context Menu */}
        {contextMenuVisible &&
          createPortal(
            <TaskContextMenu
              task={task}
              projectId={projectId}
              position={contextMenuPosition}
              onClose={handleContextMenuClose}
            />,
            document.body
          )}
      </div>
    );
  }
);

TitleColumn.displayName = 'TitleColumn';
