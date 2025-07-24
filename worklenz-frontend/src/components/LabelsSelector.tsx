import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { PlusOutlined, TagOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { RootState } from '@/app/store';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { Button, Checkbox, Tag } from '@/components';

interface LabelsSelectorProps {
  task: IProjectTask;
  isDarkMode?: boolean;
}

const LabelsSelector: React.FC<LabelsSelectorProps> = ({ task, isDarkMode = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { labels } = useSelector((state: RootState) => state.taskLabelsReducer);
  const currentSession = useAuthService().getCurrentSession();
  const { socket } = useSocket();
  const { t } = useTranslation('task-list-table');

  const filteredLabels = useMemo(() => {
    return (
      (labels as ITaskLabel[])?.filter(label =>
        label.name?.toLowerCase().includes(searchQuery.toLowerCase())
      ) || []
    );
  }, [labels, searchQuery]);

  // Update dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 300; // Approximate height of dropdown (max-height + padding)
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Position dropdown above button if there's not enough space below
      const shouldPositionAbove = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
      
      if (shouldPositionAbove) {
        setDropdownPosition({
          top: rect.top + window.scrollY - dropdownHeight - 2,
          left: rect.left + window.scrollX,
        });
      } else {
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 2,
          left: rect.left + window.scrollX,
        });
      }
    }
  }, []);

  // Close dropdown when clicking outside and handle scroll
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = (event: Event) => {
      if (isOpen) {
        // Only close dropdown if scrolling happens outside the dropdown
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    };

    const handleResize = () => {
      if (isOpen) {
        updateDropdownPosition();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    } else {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, updateDropdownPosition]);

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Labels dropdown toggle clicked, current state:', isOpen);

    if (!isOpen) {
      updateDropdownPosition();
      setIsOpen(true);
      // Focus search input after opening
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    } else {
      setIsOpen(false);
    }
  };

  const handleLabelToggle = (label: ITaskLabel) => {
    const labelData = {
      task_id: task.id,
      label_id: label.id,
      parent_task: task.parent_task_id,
      team_id: currentSession?.team_id,
    };

    socket?.emit(SocketEvents.TASK_LABELS_CHANGE.toString(), JSON.stringify(labelData));
  };

  const handleCreateLabel = () => {
    if (!searchQuery.trim()) return;

    const labelData = {
      task_id: task.id,
      label: searchQuery.trim(),
      parent_task: task.parent_task_id,
      team_id: currentSession?.team_id,
    };

    socket?.emit(SocketEvents.CREATE_LABEL.toString(), JSON.stringify(labelData));
    setSearchQuery('');
  };

  const checkLabelSelected = (labelId: string) => {
    return task?.all_labels?.some(existingLabel => existingLabel.id === labelId) || false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const existingLabel = filteredLabels.find(
      label => label.name?.toLowerCase() === searchQuery.toLowerCase()
    );

    if (!existingLabel && e.key === 'Enter') {
      handleCreateLabel();
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleDropdownToggle}
        className={`
          w-5 h-5 rounded border border-dashed flex items-center justify-center
          transition-colors duration-200
          ${
            isOpen
              ? isDarkMode
                ? 'border-blue-500 bg-blue-900/20 text-blue-400'
                : 'border-blue-500 bg-blue-50 text-blue-600'
              : isDarkMode
                ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800 text-gray-400'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-600'
          }
        `}
      >
        <PlusOutlined className="text-xs" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`
            fixed z-9999 w-72 rounded-md shadow-lg border
            ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}
          `}
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            {/* Header */}
            <div className={`p-2 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('searchLabelsPlaceholder')}
                className={`
                w-full px-2 py-1 text-xs rounded border
                ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                }
                focus:outline-none focus:ring-1 focus:ring-blue-500
              `}
              />
            </div>

            {/* Labels List */}
            <div className="max-h-48 overflow-y-auto">
              {filteredLabels && filteredLabels.length > 0 ? (
                filteredLabels.map(label => (
                  <div
                    key={label.id}
                    className={`
                    flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors
                    ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}
                  `}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLabelToggle(label);
                    }}
                  >
                    <div style={{ pointerEvents: 'none' }}>
                      <Checkbox
                        checked={checkLabelSelected(label.id || '')}
                        onChange={() => {}} // Empty handler since we handle click on the div
                        isDarkMode={isDarkMode}
                      />
                    </div>

                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: label.color_code }}
                    />

                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
                      >
                        {label.name}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                >
                  <div className="text-xs">{t('noLabelsFound')}</div>
                  {searchQuery.trim() && (
                    <button
                      onClick={handleCreateLabel}
                      className={`
                      mt-2 px-3 py-1 text-xs rounded border transition-colors
                      ${
                        isDarkMode
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }
                    `}
                    >
                      {t('createLabelButton', { name: searchQuery.trim() })}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`p-2 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
              <div className={`flex items-center justify-center gap-1 px-2 py-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <TagOutlined />
                {t('manageLabelsPath')}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default LabelsSelector;
