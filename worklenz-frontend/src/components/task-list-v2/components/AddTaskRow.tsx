import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import { Input } from '@/shared/antd-imports';
import { PlusOutlined } from '@/shared/antd-imports';
import { ArrowsAltOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';

interface AddTaskRowProps {
  groupId: string;
  groupType: string;
  groupValue: string;
  projectId: string;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
  rowId: string; // Unique identifier for this add task row
  autoFocus?: boolean; // Whether this row should auto-focus on mount
  isActive?: boolean;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onTaskCreated?: (
    task: any,
    options?: { openDrawer: boolean; insertAfterTaskId?: string | null }
  ) => void;
  isInsertMode?: boolean;
  insertAfterTaskId?: string | null;
}

const AddTaskRow: React.FC<AddTaskRowProps> = memo(
  ({
    groupId,
    groupType,
    groupValue,
    projectId,
    visibleColumns,
    rowId,
    autoFocus = false,
    isActive = false,
    onActivate,
    onDeactivate,
    onTaskCreated,
    isInsertMode = false,
    insertAfterTaskId = null,
  }) => {
    const [isAdding, setIsAdding] = useState(autoFocus || isActive);
    const [taskName, setTaskName] = useState('');
    const inputRef = useRef<any>(null);
    const { socket, connected } = useSocket();
    const { t } = useTranslation('task-list-table');

    // Get session data for reporter_id and team_id
    const currentSession = useAuthService().getCurrentSession();

    // Auto-focus when autoFocus prop is true
    useEffect(() => {
      if (autoFocus && inputRef.current) {
        setIsAdding(true);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    }, [autoFocus]);

    useEffect(() => {
      if (isActive) {
        setIsAdding(true);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      }
    }, [isActive]);

    // The global socket handler (useTaskSocketHandlers) will handle task addition
    // No need for local socket listener to avoid duplicate additions

    const handleAddTask = useCallback(
      (openDrawer: boolean = false) => {
      if (!currentSession) return;
      const normalizedTaskName =
        taskName.trim() ||
        (openDrawer ? t('untitledTaskName', { defaultValue: 'Untitled Task' }) : '');
      if (!normalizedTaskName) return;

      try {
        const body: any = {
          name: normalizedTaskName,
          project_id: projectId,
          reporter_id: currentSession.id,
          team_id: currentSession.team_id,
        };

        // Map grouping type to correct field name expected by backend
        switch (groupType) {
          case 'status':
            body.status_id = groupValue;
            break;
          case 'priority':
            body.priority_id = groupValue;
            break;
          case 'phase':
            body.phase_id = groupValue;
            break;
          default:
            // For any other grouping types, use the groupType as is
            body[groupType] = groupValue;
            break;
        }

        if (socket && connected) {
          const targetInsertAfterTaskId = insertAfterTaskId || null;
          socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
          socket.once(SocketEvents.QUICK_TASK.toString(), (task: any) => {
            if (task?.id && onTaskCreated) {
              onTaskCreated(task, {
                openDrawer,
                insertAfterTaskId: targetInsertAfterTaskId,
              });
            }
          });
          setTaskName('');
          // Keep the input focused and ready for the next task - don't create new rows
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
          // Task refresh will be handled by socket response listener
        } else {
          console.warn('Socket not connected, unable to create task');
        }
      } catch (error) {
        console.error('Error creating task:', error);
      }
      },
      [
        taskName,
        projectId,
        groupType,
        groupValue,
        socket,
        connected,
        currentSession,
        onTaskCreated,
        insertAfterTaskId,
        t,
      ]
    );

    const handleCancel = useCallback(() => {
      setTaskName('');
      setIsAdding(false);
      onDeactivate?.();
    }, [onDeactivate]);

    const handleBlur = useCallback(() => {
      if (taskName.trim() !== '') {
        // Save the task on blur, then keep the row open for the next task
        handleAddTask(false);
      } else {
        handleCancel();
      }
    }, [taskName, handleAddTask, handleCancel]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (taskName.trim() !== '') {
            setTaskName('');
            return;
          }
          handleCancel();
        } else if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          handleAddTask(true);
        }
      },
      [handleCancel, taskName, handleAddTask]
    );

    const renderColumn = useCallback(
      (columnId: string, width: string, index: number, isSticky?: boolean) => {
        // Calculate left position for sticky columns
        let leftPosition = 0; // Start at 0 to cover the row's left padding
        if (isSticky) {
          for (let i = 0; i < index; i++) {
            const prevColumn = visibleColumns[i];
            leftPosition += parseInt(prevColumn.width.replace('px', ''));
          }
        }

        const baseStyle = {
          width,
          ...(isSticky && {
            position: 'sticky' as const,
            left: leftPosition,
            zIndex: 10,
            backgroundColor: 'inherit',
            height: '100%', // Fill the row height
            display: 'flex', // Use flex to contain child
            alignItems: 'center', // Center content vertically
          }),
        };

        switch (columnId) {
          case 'dragHandle':
            return (
              <div className="border-r border-gray-200 dark:border-gray-700 pl-1" style={baseStyle} />
            );
          case 'checkbox':
          case 'taskKey':
          case 'description':
            return (
              <div className="border-r border-gray-200 dark:border-gray-700" style={baseStyle} />
            );
          case 'labels':
            const labelsStyle = {
              ...baseStyle,
              ...(width === 'auto' ? { minWidth: '200px', flexGrow: 1 } : {}),
            };
            return (
              <div className="border-r border-gray-200 dark:border-gray-700" style={labelsStyle} />
            );
          case 'title':
            return (
              <div className="flex items-center h-full" style={baseStyle}>
                <div className="flex items-center w-full h-full">
                  <div className="w-1 mr-1" />

                  {!isAdding ? (
                    <button
                      onClick={() => {
                        onActivate?.();
                        setIsAdding(true);
                      }}
                      className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors h-full w-full px-2"
                    >
                      <PlusOutlined className="text-xs" />
                      {isInsertMode
                        ? t('insertTaskText', { defaultValue: 'Insert Task' })
                        : t('addTaskText', { defaultValue: 'Add Task' })}
                    </button>
                  ) : (
                    <div className="flex items-center w-full h-full gap-1 pr-1">
                      <Input
                        ref={inputRef}
                        value={taskName}
                        onChange={e => setTaskName(e.target.value)}
                        onPressEnter={() => handleAddTask(false)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder={t('addTaskInputPlaceholder', {
                          defaultValue: 'Type task name and press Enter to save',
                        })}
                        className="w-full h-full border-none shadow-none bg-transparent"
                        style={{
                          height: '100%',
                          minHeight: '32px',
                          padding: '4px 8px',
                          fontSize: '14px',
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleAddTask(true)}
                        className="h-7 w-7 shrink-0 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500 transition-colors flex items-center justify-center"
                        title={t('openTask', { defaultValue: 'Open task' })}
                        aria-label={t('openTask', { defaultValue: 'Open task' })}
                      >
                        <ArrowsAltOutlined className="text-xs" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          default:
            return (
              <div className="border-r border-gray-200 dark:border-gray-700" style={baseStyle} />
            );
        }
      },
      [
        isAdding,
        taskName,
        handleAddTask,
        handleCancel,
        handleBlur,
        handleKeyDown,
        t,
        visibleColumns,
        onActivate,
        isInsertMode,
      ]
    );

    return (
      <div className="flex items-center min-w-max px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[36px]">
        {visibleColumns.map((column, index) => (
          <React.Fragment key={column.id}>
            {renderColumn(column.id, column.width, index, column.isSticky)}
          </React.Fragment>
        ))}
      </div>
    );
  }
);

AddTaskRow.displayName = 'AddTaskRow';

export default AddTaskRow;
