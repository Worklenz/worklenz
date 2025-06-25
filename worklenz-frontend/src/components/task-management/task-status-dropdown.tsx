import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { Task } from '@/types/task-management.types';

interface TaskStatusDropdownProps {
  task: Task;
  projectId: string;
  isDarkMode?: boolean;
}

const TaskStatusDropdown: React.FC<TaskStatusDropdownProps> = ({ 
  task, 
  projectId, 
  isDarkMode = false 
}) => {
  const { socket, connected } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const statusList = useAppSelector(state => state.taskStatusReducer.status);

  // Find current status details
  const currentStatus = useMemo(() => {
    return statusList.find(status => 
      status.name?.toLowerCase() === task.status?.toLowerCase() ||
      status.id === task.status
    );
  }, [statusList, task.status]);

  // Handle status change
  const handleStatusChange = useCallback((statusId: string, statusName: string) => {
    if (!task.id || !statusId || !connected) return;

    socket?.emit(
      SocketEvents.TASK_STATUS_CHANGE.toString(),
      JSON.stringify({
        task_id: task.id,
        status_id: statusId,
        parent_task: null, // Assuming top-level tasks for now
        team_id: projectId, // Using projectId as teamId
      })
    );
    socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
    setIsOpen(false);
  }, [task.id, connected, socket, projectId]);

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
      // Calculate position
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
      
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Get status color
  const getStatusColor = useCallback((status: any) => {
    if (isDarkMode) {
      return status?.color_code_dark || status?.color_code || '#6b7280';
    }
    return status?.color_code || '#6b7280';
  }, [isDarkMode]);



  // Status display name
  const getStatusDisplayName = useCallback((status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }, []);

  if (!task.status) return null;

  return (
    <>
      {/* Status Button */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Status dropdown clicked, current isOpen:', isOpen);
          setIsOpen(!isOpen);
        }}
        className={`
          inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium
          transition-all duration-200 hover:opacity-80 border-0 min-w-[70px] justify-center
        `}
        style={{
          backgroundColor: currentStatus ? getStatusColor(currentStatus) : (isDarkMode ? '#6b7280' : '#9ca3af'),
          color: 'white',
        }}
      >
        <span>{currentStatus?.name || getStatusDisplayName(task.status)}</span>
        <svg 
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu - Rendered in Portal */}
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className={`
            fixed min-w-[120px] max-w-[180px] 
            rounded-lg shadow-xl border z-[9999]
            ${isDarkMode 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
            }
          `}
          style={{ 
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 9999 
          }}
        >
          <div className="py-1">
            {statusList.map((status) => (
              <button
                key={status.id}
                onClick={() => handleStatusChange(status.id!, status.name!)}
                className={`
                  w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2
                  transition-colors duration-150 rounded-md mx-1
                  ${isDarkMode 
                    ? 'hover:bg-gray-700 text-gray-200' 
                    : 'hover:bg-gray-50 text-gray-900'
                  }
                  ${(status.name?.toLowerCase() === task.status?.toLowerCase() || status.id === task.status)
                    ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-50') 
                    : ''
                  }
                `}
              >
                {/* Status Pill Preview */}
                <div 
                  className="px-2 py-0.5 rounded-full text-white text-xs min-w-[50px] text-center"
                  style={{ backgroundColor: getStatusColor(status) }}
                >
                  {status.name}
                </div>
                
                {/* Current Status Indicator */}
                {(status.name?.toLowerCase() === task.status?.toLowerCase() || status.id === task.status) && (
                  <div className="ml-auto">
                    <div className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-blue-400' : 'bg-blue-500'}`} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default TaskStatusDropdown; 