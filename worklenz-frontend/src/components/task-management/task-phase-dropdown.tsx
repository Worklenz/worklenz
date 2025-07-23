import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { Task } from '@/types/task-management.types';
import { ClearOutlined } from '@/shared/antd-imports';

interface TaskPhaseDropdownProps {
  task: Task;
  projectId: string;
  isDarkMode?: boolean;
}

const TaskPhaseDropdown: React.FC<TaskPhaseDropdownProps> = ({
  task,
  projectId,
  isDarkMode = false,
}) => {
  const { socket, connected } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { phaseList } = useAppSelector(state => state.phaseReducer);

  // Find current phase details
  const currentPhase = useMemo(() => {
    return phaseList.find(phase => phase.name === task.phase);
  }, [phaseList, task.phase]);

  // Handle phase change
  const handlePhaseChange = useCallback(
    (phaseId: string, phaseName: string) => {
      if (!task.id || !phaseId || !connected) return;

      socket?.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
        task_id: task.id,
        phase_id: phaseId,
        parent_task: null, // Assuming top-level tasks for now
      });
      setIsOpen(false);
    },
    [task.id, connected, socket]
  );

  // Handle phase clear
  const handlePhaseClear = useCallback(() => {
    if (!task.id || !connected) return;

    socket?.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
      task_id: task.id,
      phase_id: null,
      parent_task: null,
    });
    setIsOpen(false);
  }, [task.id, connected, socket]);

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

  // Get phase color
  const getPhaseColor = useCallback((phase: any) => {
    return phase?.color_code || '#722ed1';
  }, []);

  // Format phase name for display
  const formatPhaseName = useCallback((name: string) => {
    if (!name) return 'Select';
    return name;
  }, []);

  // Determine if no phase is selected
  const hasPhase = task.phase && task.phase.trim() !== '';

  return (
    <>
      {/* Phase Button - Show "Select" when no phase */}
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
          backgroundColor:
            hasPhase && currentPhase
              ? getPhaseColor(currentPhase)
              : isDarkMode
                ? '#4b5563'
                : '#9ca3af',
          color: 'white',
        }}
      >
        <span className="truncate">
          {hasPhase && currentPhase ? formatPhaseName(currentPhase.name || '') : 'Select'}
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
            {/* Phase Options */}
            <div className="py-1 max-h-64 overflow-y-auto">
              {/* No Phase Option */}
              <button
                onClick={handlePhaseClear}
                className={`
                w-full px-3 py-2.5 text-left text-xs font-medium flex items-center gap-3
                transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]
                ${
                  isDarkMode
                    ? 'hover:bg-gray-700/80 text-gray-100'
                    : 'hover:bg-gray-50/70 text-gray-900'
                }
                ${
                  !hasPhase
                    ? isDarkMode
                      ? 'bg-gray-700/60 ring-1 ring-blue-400/40'
                      : 'bg-blue-50/50 ring-1 ring-blue-200'
                    : ''
                }
              `}
                style={{
                  animation: 'slideInFromLeft 0.2s ease-out forwards',
                }}
              >
                {/* Clear Icon */}
                <div className="flex items-center justify-center w-4 h-4">
                  <ClearOutlined className="w-3 h-3" />
                </div>

                {/* No Phase Color Indicator */}
                <div
                  className={`w-3 h-3 rounded-full shadow-sm border-2 ${
                    isDarkMode ? 'border-gray-800/30' : 'border-white/20'
                  }`}
                  style={{ backgroundColor: isDarkMode ? '#4b5563' : '#9ca3af' }}
                />

                {/* No Phase Text */}
                <span className="flex-1 truncate">No Phase</span>

                {/* Current Selection Badge */}
                {!hasPhase && (
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

              {/* Phase Options */}
              {phaseList.map((phase, index) => {
                const isSelected = phase.name === task.phase;

                return (
                  <button
                    key={phase.id}
                    onClick={() => handlePhaseChange(phase.id!, phase.name!)}
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
                      animationDelay: `${(index + 1) * 30}ms`,
                      animation: 'slideInFromLeft 0.2s ease-out forwards',
                    }}
                  >
                    {/* Phase Color Indicator */}
                    <div
                      className={`w-3 h-3 rounded-full shadow-sm border-2 ${
                        isDarkMode ? 'border-gray-800/30' : 'border-white/20'
                      }`}
                      style={{ backgroundColor: getPhaseColor(phase) }}
                    />

                    {/* Phase Name */}
                    <span className="flex-1 truncate">{formatPhaseName(phase.name || '')}</span>

                    {/* Current Phase Badge */}
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

export default TaskPhaseDropdown;
