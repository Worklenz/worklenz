import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { selectTaskById, createSubtask, selectSubtaskLoading } from '@/features/task-management/task-management.slice';
import TaskRow from './TaskRow';
import SubtaskLoadingSkeleton from './SubtaskLoadingSkeleton';
import { Task } from '@/types/task-management.types';
import { Input, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';

interface TaskRowWithSubtasksProps {
  taskId: string;
  projectId: string;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
  isFirstInGroup?: boolean;
  updateTaskCustomColumnValue?: (taskId: string, columnKey: string, value: string) => void;
}

interface AddSubtaskRowProps {
  parentTaskId: string;
  projectId: string;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
  onSubtaskAdded: (rowId: string) => void;
  rowId: string; // Unique identifier for this add subtask row
  autoFocus?: boolean; // Whether this row should auto-focus on mount
}

const AddSubtaskRow: React.FC<AddSubtaskRowProps> = memo(({ 
  parentTaskId, 
  projectId, 
  visibleColumns, 
  onSubtaskAdded,
  rowId,
  autoFocus = false
}) => {
  const [isAdding, setIsAdding] = useState(autoFocus);
  const [subtaskName, setSubtaskName] = useState('');
  const inputRef = useRef<any>(null);
  const { socket, connected } = useSocket();
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  
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

  const handleAddSubtask = useCallback(() => {
    if (!subtaskName.trim() || !currentSession) return;

    // Create optimistic subtask immediately for better UX
    dispatch(createSubtask({ 
      parentTaskId, 
      name: subtaskName.trim(), 
      projectId 
    }));

    // Emit socket event for server-side creation
    if (connected && socket) {
      socket.emit(
        SocketEvents.QUICK_TASK.toString(),
        JSON.stringify({
          name: subtaskName.trim(),
          project_id: projectId,
          parent_task_id: parentTaskId,
          reporter_id: currentSession.id,
          team_id: currentSession.team_id,
        })
      );
    }

    setSubtaskName('');
    // Keep the input active and notify parent to create new row
    onSubtaskAdded(rowId);
  }, [subtaskName, dispatch, parentTaskId, projectId, connected, socket, currentSession, onSubtaskAdded, rowId]);

  const handleCancel = useCallback(() => {
    if (subtaskName.trim() === '') {
      setSubtaskName('');
      setIsAdding(false);
    }
  }, [subtaskName]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleCancel]);

  const renderColumn = useCallback((columnId: string, width: string) => {
    const baseStyle = { width };

    switch (columnId) {
      case 'dragHandle':
        return <div style={baseStyle} />;
      case 'checkbox':
        return <div style={baseStyle} />;
      case 'taskKey':
        return <div style={baseStyle} />;
      case 'description':
        return <div style={baseStyle} />;
      case 'title':
        return (
          <div className="flex items-center h-full" style={baseStyle}>
            <div className="flex items-center w-full h-full">
              {/* Match subtask indentation pattern - tighter spacing */}
              <div className="w-4" />
              <div className="w-2" />
              
              {!isAdding ? (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors h-full"
                >
                  <PlusOutlined className="text-xs" />
                  {t('addSubTaskText')}
                </button>
              ) : (
                <Input
                  ref={inputRef}
                  value={subtaskName}
                  onChange={(e) => setSubtaskName(e.target.value)}
                  onPressEnter={handleAddSubtask}
                  onBlur={handleCancel}
                  onKeyDown={handleKeyDown}
                  placeholder="Type subtask name and press Enter to save"
                  className="w-full h-full border-none shadow-none bg-transparent"
                  style={{ 
                    height: '100%',
                    minHeight: '32px',
                    padding: '0',
                    fontSize: '14px'
                  }}
                  autoFocus
                />
              )}
            </div>
          </div>
        );
      default:
        return <div style={baseStyle} />;
    }
  }, [isAdding, subtaskName, handleAddSubtask, handleCancel, handleKeyDown, t]);

  return (
    <div className="flex items-center min-w-max px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[36px] border-b border-gray-200 dark:border-gray-700">
      {visibleColumns.map((column, index) => (
        <React.Fragment key={column.id}>
          {renderColumn(column.id, column.width)}
        </React.Fragment>
      ))}
    </div>
  );
});

AddSubtaskRow.displayName = 'AddSubtaskRow';

const TaskRowWithSubtasks: React.FC<TaskRowWithSubtasksProps> = memo(({ 
  taskId, 
  projectId, 
  visibleColumns,
  isFirstInGroup = false,
  updateTaskCustomColumnValue
}) => {
  const task = useAppSelector(state => selectTaskById(state, taskId));
  const isLoadingSubtasks = useAppSelector(state => selectSubtaskLoading(state, taskId));
  const dispatch = useAppDispatch();
  const [addSubtaskRows, setAddSubtaskRows] = useState<string[]>([`add-subtask-${taskId}-0`]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const handleSubtaskAdded = useCallback((rowId: string) => {
    // Refresh subtasks after adding a new one
    // The socket event will handle the real-time update
    
    // Only add a new row if this is the last (most recent) row
    setAddSubtaskRows(prev => {
      const currentIndex = prev.indexOf(rowId);
      const isLastRow = currentIndex === prev.length - 1;
      
      if (isLastRow) {
        const newRowId = `add-subtask-${taskId}-${prev.length}`;
        // Set the new row as active
        setActiveRowId(newRowId);
        return [...prev, newRowId];
      }
      
      return prev; // Don't add new row if this isn't the last row
    });
  }, [taskId]);

  if (!task) {
    return null;
  }

  return (
    <>
      {/* Main task row */}
      <TaskRow
        taskId={taskId}
        projectId={projectId}
        visibleColumns={visibleColumns}
        isFirstInGroup={isFirstInGroup}
        updateTaskCustomColumnValue={updateTaskCustomColumnValue}
      />
      
      {/* Subtasks and add subtask row when expanded */}
      {task.show_sub_tasks && (
        <>
          {/* Show loading skeleton while fetching subtasks */}
          {isLoadingSubtasks && (
            <>
              <SubtaskLoadingSkeleton visibleColumns={visibleColumns} />
            </>
          )}
          
          {/* Render existing subtasks when not loading */}
          {!isLoadingSubtasks && task.sub_tasks?.map((subtask: Task) => (
            <div key={subtask.id} className="bg-gray-50 dark:bg-gray-800/50 border-l-2 border-blue-200 dark:border-blue-700">
              <TaskRow
                taskId={subtask.id}
                projectId={projectId}
                visibleColumns={visibleColumns}
                isSubtask={true}
                updateTaskCustomColumnValue={updateTaskCustomColumnValue}
              />
            </div>
          ))}
          
          {/* Add subtask rows - only show when not loading */}
          {!isLoadingSubtasks && (
            <>
              {/* Render all add subtask rows */}
              {addSubtaskRows.map((rowId, index) => (
                <div key={rowId} className="bg-gray-50 dark:bg-gray-800/50 border-l-2 border-blue-200 dark:border-blue-700">
                  <AddSubtaskRow
                    parentTaskId={taskId}
                    projectId={projectId}
                    visibleColumns={visibleColumns}
                    onSubtaskAdded={handleSubtaskAdded}
                    rowId={rowId}
                    autoFocus={index === addSubtaskRows.length - 1} // Auto-focus the latest row
                  />
                </div>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
});

TaskRowWithSubtasks.displayName = 'TaskRowWithSubtasks';

export default TaskRowWithSubtasks; 