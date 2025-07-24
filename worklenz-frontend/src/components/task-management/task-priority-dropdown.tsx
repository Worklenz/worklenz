import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { Task } from '@/types/task-management.types';
import { MinusOutlined, PauseOutlined, DoubleRightOutlined } from '@/shared/antd-imports';

interface TaskPriorityDropdownProps {
  task: Task;
  projectId: string;
  isDarkMode?: boolean;
}

const TaskPriorityDropdown: React.FC<TaskPriorityDropdownProps> = ({
  task,
  projectId,
  isDarkMode = false,
}) => {
  const { socket, connected } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const priorityList = useAppSelector(state => state.priorityReducer.priorities);

  // Find current priority details
  const currentPriority = useMemo(() => {
    return priorityList.find(
      priority =>
        priority.name?.toLowerCase() === task.priority?.toLowerCase() ||
        priority.id === task.priority
    );
  }, [priorityList, task.priority]);

  // Handle priority change
  const handlePriorityChange = useCallback(
    (priorityId: string, priorityName: string) => {
      if (!task.id || !priorityId || !connected) return;

      console.log('🎯 Priority change initiated:', { taskId: task.id, priorityId, priorityName });

      socket?.emit(
        SocketEvents.TASK_PRIORITY_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          priority_id: priorityId,
          team_id: projectId, // Using projectId as teamId
        })
      );
      setIsOpen(false);
    },
    [task.id, connected, socket, projectId]
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

  // Get priority color
  const getPriorityColor = useCallback(
    (priority: any) => {
      if (isDarkMode) {
        return priority?.color_code_dark || priority?.color_code || '#4b5563';
      }
      return priority?.color_code || '#6b7280';
    },
    [isDarkMode]
  );

  // Get priority icon
  const getPriorityIcon = useCallback((priorityName: string) => {
    const name = priorityName?.toLowerCase();
    switch (name) {
      case 'low':
        return <MinusOutlined className="w-3 h-3" />;
      case 'medium':
        return <PauseOutlined className="w-3 h-3" style={{ transform: 'rotate(90deg)' }} />;
      case 'high':
        return <DoubleRightOutlined className="w-3 h-3" style={{ transform: 'rotate(90deg)' }} />;
      default:
        return <MinusOutlined className="w-3 h-3" />;
    }
  }, []);

  // Format priority name for display
  const formatPriorityName = useCallback((name: string) => {
    if (!name) return name;
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }, []);

  if (!task.priority) return null;

  return (
    <>
      {/* Priority Button - Simple text display like status */}
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
          backgroundColor: currentPriority
            ? getPriorityColor(currentPriority)
            : isDarkMode
              ? '#4b5563'
              : '#9ca3af',
          color: 'white',
        }}
      >
        <span className="truncate">
          {currentPriority
            ? formatPriorityName(currentPriority.name || '')
            : formatPriorityName(task.priority)}
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

      {/* Dropdown Menu */}
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
            {/* Priority Options */}
            <div className="py-1 max-h-64 overflow-y-auto">
              {priorityList.map((priority, index) => {
                const isSelected =
                  priority.name?.toLowerCase() === task.priority?.toLowerCase() ||
                  priority.id === task.priority;

                return (
                  <button
                    key={priority.id}
                    onClick={() => handlePriorityChange(priority.id!, priority.name!)}
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
                    {/* Priority Icon */}
                    <div className="flex items-center justify-center w-4 h-4">
                      {getPriorityIcon(priority.name || '')}
                    </div>

                    {/* Priority Color Indicator */}
                    <div
                      className={`w-3 h-3 rounded-full shadow-sm border-2 ${
                        isDarkMode ? 'border-gray-800/30' : 'border-white/20'
                      }`}
                      style={{ backgroundColor: getPriorityColor(priority) }}
                    />

                    {/* Priority Name */}
                    <span className="flex-1 truncate">
                      {formatPriorityName(priority.name || '')}
                    </span>

                    {/* Current Priority Badge */}
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

      {/* CSS Animations */}
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

export default TaskPriorityDropdown;
