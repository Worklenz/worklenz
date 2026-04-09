import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DownOutlined, SortAscendingOutlined, SortDescendingOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchTasksV3, setSort } from '@/features/task-management/task-management.slice';
import {
  selectSortField,
  selectSortOrder,
} from '@/features/task-management/task-management.selectors';
import { selectCurrentGrouping } from '@/features/task-management/grouping.slice';
import { ThemeClasses } from './types';

interface SortDropdownProps {
  themeClasses: ThemeClasses;
  isDarkMode: boolean;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({ themeClasses, isDarkMode }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const { projectId } = useAppSelector(state => state.projectReducer);
  const currentSortField = useAppSelector(selectSortField);
  const currentSortOrder = useAppSelector(selectSortOrder);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const [open, setOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const sortFieldsList = useMemo(() => {
    const allFields = [
      { label: t('keyText'), key: 'task_key' },
      { label: t('taskText', { defaultValue: 'Task' }), key: 'name' },
      { label: t('statusText', { defaultValue: 'Status' }), key: 'status' },
      { label: t('priorityText', { defaultValue: 'Priority' }), key: 'priority' },
      { label: t('startDateText', { defaultValue: 'Start Date' }), key: 'start_date' },
      { label: t('dueDateText', { defaultValue: 'Due Date' }), key: 'end_date' },
      { label: t('completedDateText', { defaultValue: 'Completed Date' }), key: 'completed_at' },
      { label: t('createdDateText', { defaultValue: 'Created Date' }), key: 'created_at' },
      { label: t('lastUpdatedText', { defaultValue: 'Last Updated' }), key: 'updated_at' },
    ];

    return allFields.filter(field => {
      if (currentGrouping === 'status' && field.key === 'status') return false;
      if (currentGrouping === 'priority' && field.key === 'priority') return false;
      return true;
    });
  }, [t, currentGrouping]);

  const handleSortFieldChange = (fieldKey: string) => {
    if (currentSortField === fieldKey) {
      const newOrder = currentSortOrder === 'ASC' ? 'DESC' : 'ASC';
      dispatch(setSort({ field: fieldKey, order: newOrder }));
    } else {
      dispatch(setSort({ field: fieldKey, order: 'ASC' }));
    }

    if (projectId) {
      dispatch(fetchTasksV3(projectId));
    }

    setOpen(false);
  };

  const clearSort = () => {
    dispatch(setSort({ field: '', order: 'ASC' }));
    if (projectId) {
      dispatch(fetchTasksV3(projectId));
    }
  };

  React.useEffect(() => {
    if (
      (currentGrouping === 'status' && currentSortField === 'status') ||
      (currentGrouping === 'priority' && currentSortField === 'priority')
    ) {
      clearSort();
    }
  }, [currentGrouping]);

  const isActive = currentSortField !== '';
  const currentFieldLabel = sortFieldsList.find(f => f.key === currentSortField)?.label;
  const orderText =
    currentSortOrder === 'ASC'
      ? t('ascendingOrder', { defaultValue: 'Ascending Order' })
      : t('descendingOrder', { defaultValue: 'Descending Order' });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        title={
          isActive
            ? t('currentSort', { field: currentFieldLabel, order: orderText })
            : t('sortText', { defaultValue: 'Sort' })
        }
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
          border transition-all duration-200 ease-in-out
          ${
            isActive
              ? isDarkMode
                ? 'bg-gray-600 text-white border-gray-500'
                : 'bg-gray-200 text-gray-800 border-gray-300 font-semibold'
              : `${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`
          }
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
          ${isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
        `}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {currentSortOrder === 'ASC' ? (
          <SortAscendingOutlined className="w-3.5 h-3.5" />
        ) : (
          <SortDescendingOutlined className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">{t('sortText', { defaultValue: 'Sort' })}</span>
        {isActive && currentFieldLabel && (
          <span
            className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} max-w-16 truncate hidden md:inline`}
          >
            {currentFieldLabel}
          </span>
        )}
        <DownOutlined
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}
        >
          {isActive && (
            <div className={`p-2 border-b ${themeClasses.dividerBorder}`}>
              <button
                onClick={clearSort}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors duration-150 ${themeClasses.optionText} ${themeClasses.optionHover}`}
              >
                {t('clearSort', { defaultValue: 'Clear Sort' })}
              </button>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto">
            <div className="p-0.5">
              {sortFieldsList.map((sortField: { label: string; key: string }) => {
                const isSelected = currentSortField === sortField.key;

                return (
                  <button
                    key={sortField.key}
                    onClick={() => handleSortFieldChange(sortField.key)}
                    className={`
                      w-full flex items-center justify-between gap-2 px-2 py-1.5 text-xs rounded
                      transition-colors duration-150 text-left
                      ${
                        isSelected
                          ? isDarkMode
                            ? 'bg-gray-600 text-white'
                            : 'bg-gray-200 text-gray-800 font-semibold'
                          : `${themeClasses.optionText} ${themeClasses.optionHover}`
                      }
                    `}
                    title={
                      isSelected
                        ? t('currentSort', {
                            field: sortField.label,
                            order: orderText,
                          }) + ` - ${t('sortDescending', { defaultValue: 'Sort Descending' })}`
                        : t('sortByField', { field: sortField.label }) +
                          ` - ${t('sortAscending', { defaultValue: 'Sort Ascending' })}`
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{sortField.label}</span>
                      {isSelected && (
                        <span
                          className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                        >
                          ({orderText})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isSelected ? (
                        currentSortOrder === 'ASC' ? (
                          <SortAscendingOutlined className="w-3.5 h-3.5" />
                        ) : (
                          <SortDescendingOutlined className="w-3.5 h-3.5" />
                        )
                      ) : (
                        <SortAscendingOutlined className="w-3.5 h-3.5 opacity-50" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
