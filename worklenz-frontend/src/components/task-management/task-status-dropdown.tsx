import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { Task } from '@/types/task-management.types';
import {
  updateTask,
  selectCurrentGroupingV3,
  selectGroups,
  moveTaskBetweenGroups,
} from '@/features/task-management/task-management.slice';

interface TaskStatusDropdownProps {
  task: Task;
  projectId: string;
  isDarkMode?: boolean;
}

const TaskStatusDropdown: React.FC<TaskStatusDropdownProps> = ({
  task,
  projectId,
  isDarkMode = false,
}) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const currentGroupingV3 = useAppSelector(selectCurrentGroupingV3);
  const groups = useAppSelector(selectGroups);

  // Find current status details
  const currentStatus = useMemo(() => {
    return statusList.find(
      status =>
        status.name?.toLowerCase() === task.status?.toLowerCase() || status.id === task.status
    );
  }, [statusList, task.status]);

  // Handle status change
  const handleStatusChange = useCallback(
    (statusId: string, statusName: string) => {
      if (!task.id || !statusId || !connected) return;

      // Optimistic update: immediately update the task status in Redux for instant feedback
      const updatedTask = {
        ...task,
        status: statusId,
        updatedAt: new Date().toISOString(),
      };
      dispatch(updateTask(updatedTask));

      // Handle group movement if grouping by status
      if (currentGroupingV3 === 'status' && groups && groups.length > 0) {
        // Find current group containing the task
        const currentGroup = groups.find(group => group.taskIds.includes(task.id));
        
        // Find target group based on the new status ID
        let targetGroup = groups.find(group => group.id === statusId);
        
        // If not found by status ID, try matching with group value
        if (!targetGroup) {
          targetGroup = groups.find(group => group.groupValue === statusId);
        }

        if (currentGroup && targetGroup && currentGroup.id !== targetGroup.id) {
          // Move task between groups immediately for instant feedback
          dispatch(
            moveTaskBetweenGroups({
              taskId: task.id,
              sourceGroupId: currentGroup.id,
              targetGroupId: targetGroup.id,
            })
          );
        }
      }

      // Emit socket event for server-side update and real-time sync
      socket?.emit(
        SocketEvents.TASK_STATUS_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          status_id: statusId,
          parent_task: task.parent_task_id || null,
          team_id: projectId,
        })
      );
      socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
      setIsOpen(false);
    },
    [task, connected, socket, projectId, dispatch, currentGroupingV3, groups]
  );

  // Calculate dropdown position and handle outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && buttonRef.current.contains(event.target as Node)) {
        return; // Don't close if clicking the button
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen && buttonRef.current) {
      // Calculate position with better handling of scrollable containers
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 200; // Estimated dropdown height

      // Check if dropdown would go below viewport
      const spaceBelow = viewportHeight - rect.bottom;
      const shouldShowAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setDropdownPosition({
        top: shouldShowAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
      });

      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Get status color - enhanced dark mode support
  const getStatusColor = useCallback(
    (status: any) => {
      if (isDarkMode) {
        return status?.color_code_dark || status?.color_code || '#4b5563';
      }
      return status?.color_code || '#6b7280';
    },
    [isDarkMode]
  );

  // Status display name - format status names by replacing underscores with spaces
  const getStatusDisplayName = useCallback((status: string) => {
    return status
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize first letter of each word
  }, []);

  // Format status name for display
  const formatStatusName = useCallback((name: string) => {
    if (!name) return name;
    return name.replace(/_/g, ' '); // Replace underscores with spaces
  }, []);

  if (!task.status) return null;

  return (
    <>
      {/* Status Button - Rounded Pill Design */}
      <button
        ref={buttonRef}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`
          inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium
          transition-all duration-200 hover:opacity-80 border-0 min-w-[70px] max-w-full justify-center
          whitespace-nowrap
        `}
        style={{
          backgroundColor: currentStatus
            ? getStatusColor(currentStatus)
            : isDarkMode
              ? '#4b5563'
              : '#9ca3af',
          color: 'white',
        }}
      >
        <span className="truncate">
          {currentStatus
            ? formatStatusName(currentStatus.name || '')
            : getStatusDisplayName(task.status)}
        </span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu - Redesigned */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`
            fixed min-w-[160px] max-w-[220px] 
            rounded border backdrop-blur-xs z-9999
            ${
              isDarkMode
                ? 'bg-gray-900/95 border-gray-600 shadow-2xl shadow-black/50'
                : 'bg-white/95 border-gray-200 shadow-2xl shadow-gray-500/20'
            }
          `}
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              zIndex: 9999,
              animation: 'fadeInScale 0.15s ease-out',
            }}
          >
            {/* Status Options */}
            <div className="py-1 max-h-64 overflow-y-auto">
              {statusList.map((status, index) => {
                const isSelected =
                  status.name?.toLowerCase() === task.status?.toLowerCase() ||
                  status.id === task.status;

                return (
                  <button
                    key={status.id}
                    onClick={() => handleStatusChange(status.id!, status.name!)}
                    className={`
                    w-full px-3 py-2.5 text-left text-xs font-medium flex items-center gap-3
                    transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]
                    ${
                      isDarkMode
                        ? 'hover:bg-gray-700/80 text-gray-100'
                        : 'hover:bg-gray-50/70 text-gray-900'
                    }
                    ${
                      isSelected
                        ? isDarkMode
                          ? 'bg-gray-700/60 ring-1 ring-blue-400/40'
                          : 'bg-blue-50/50 ring-1 ring-blue-200'
                        : ''
                    }
                  `}
                    style={{
                      animationDelay: `${index * 30}ms`,
                      animation: 'slideInFromLeft 0.2s ease-out forwards',
                    }}
                  >
                    {/* Status Color Indicator */}
                    <div
                      className={`w-3 h-3 rounded-full shadow-sm border-2 ${
                        isDarkMode ? 'border-gray-800/30' : 'border-white/20'
                      }`}
                      style={{ backgroundColor: getStatusColor(status) }}
                    />

                    {/* Status Name */}
                    <span className="flex-1 truncate">{formatStatusName(status.name || '')}</span>

                    {/* Current Status Badge */}
                    {isSelected && (
                      <div className="flex items-center gap-1">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-blue-400' : 'bg-blue-500'}`}
                        />
                        <span
                          className={`text-xs font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}
                        >
                          Current
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}

      {/* CSS Animations - Injected as style tag */}
      {isOpen &&
        createPortal(
          <style>
            {`
            @keyframes fadeInScale {
              from {
                opacity: 0;
                transform: scale(0.95) translateY(-5px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
            
            @keyframes slideInFromLeft {
              from {
                opacity: 0;
                transform: translateX(-10px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
          `}
          </style>,
          document.head
        )}
    </>
  );
};

export default TaskStatusDropdown;
