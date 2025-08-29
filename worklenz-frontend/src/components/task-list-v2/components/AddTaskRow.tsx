import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import { Input } from '@/shared/antd-imports';
import { PlusOutlined } from '@/shared/antd-imports';
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
  onTaskAdded: (rowId: string) => void;
  rowId: string; // Unique identifier for this add task row
  autoFocus?: boolean; // Whether this row should auto-focus on mount
}

const AddTaskRow: React.FC<AddTaskRowProps> = memo(
  ({
    groupId,
    groupType,
    groupValue,
    projectId,
    visibleColumns,
    onTaskAdded,
    rowId,
    autoFocus = false,
  }) => {
    const [isAdding, setIsAdding] = useState(autoFocus);
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

    // The global socket handler (useTaskSocketHandlers) will handle task addition
    // No need for local socket listener to avoid duplicate additions

    const handleAddTask = useCallback(() => {
      if (!taskName.trim() || !currentSession) return;

      try {
        const body: any = {
          name: taskName.trim(),
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
          socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
          setTaskName('');
          // Keep the input active and notify parent to create new row
          onTaskAdded(rowId);
          // Task refresh will be handled by socket response listener
        } else {
          console.warn('Socket not connected, unable to create task');
        }
      } catch (error) {
        console.error('Error creating task:', error);
      }
    }, [
      taskName,
      projectId,
      groupType,
      groupValue,
      socket,
      connected,
      currentSession,
      onTaskAdded,
      rowId,
    ]);

    const handleCancel = useCallback(() => {
      if (taskName.trim() === '') {
        setTaskName('');
        setIsAdding(false);
      }
    }, [taskName]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCancel();
        }
      },
      [handleCancel]
    );

    const renderColumn = useCallback(
      (columnId: string, width: string) => {
        const baseStyle = { width };

        switch (columnId) {
          case 'dragHandle':
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
                      onClick={() => setIsAdding(true)}
                      className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors h-full"
                    >
                      <PlusOutlined className="text-xs" />
                      {t('addTaskText')}
                    </button>
                  ) : (
                    <Input
                      ref={inputRef}
                      value={taskName}
                      onChange={e => setTaskName(e.target.value)}
                      onPressEnter={handleAddTask}
                      onBlur={handleCancel}
                      onKeyDown={handleKeyDown}
                      placeholder="Type task name and press Enter to save"
                      className="w-full h-full border-none shadow-none bg-transparent"
                      style={{
                        height: '100%',
                        minHeight: '32px',
                        padding: '4px 8px',
                        fontSize: '14px',
                      }}
                      autoFocus
                    />
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
      [isAdding, taskName, handleAddTask, handleCancel, handleKeyDown, t]
    );

    return (
      <div className="flex items-center min-w-max px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[36px]">
        {visibleColumns.map((column, index) => (
          <React.Fragment key={column.id}>{renderColumn(column.id, column.width)}</React.Fragment>
        ))}
      </div>
    );
  }
);

AddTaskRow.displayName = 'AddTaskRow';

export default AddTaskRow;
