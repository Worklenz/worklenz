import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckOutlined, DownOutlined, EyeOutlined } from '@/shared/antd-imports';
import { RootState } from '@/app/store';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  syncFieldWithDatabase,
  toggleField,
} from '@/features/task-management/taskListFields.slice';
import { selectColumns } from '@/features/task-management/task-management.selectors';
import { ThemeClasses } from './types';

const LOCAL_STORAGE_KEY = 'worklenz.taskManagement.fields';

interface FieldsDropdownProps {
  themeClasses: ThemeClasses;
  isDarkMode: boolean;
  createDebouncedFunction: <T extends (...args: any[]) => void>(
    func: T,
    delay: number
  ) => T & { cancel: () => void };
}

export const FieldsDropdown: React.FC<FieldsDropdownProps> = ({
  themeClasses,
  isDarkMode,
  createDebouncedFunction,
}) => {
  const { t } = useTranslation('task-list-filters');
  const { t: tTable } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();

  const getFieldLabel = useCallback(
    (fieldKey: string) => {
      const keyMappings: Record<string, string> = {
        KEY: 'keyColumn',
        DESCRIPTION: 'descriptionColumn',
        PROGRESS: 'progressColumn',
        ASSIGNEES: 'assigneesColumn',
        LABELS: 'labelsColumn',
        PHASE: 'phaseColumn',
        STATUS: 'statusColumn',
        PRIORITY: 'priorityColumn',
        TIME_TRACKING: 'timeTrackingColumn',
        ESTIMATION: 'estimationColumn',
        START_DATE: 'startDateColumn',
        DUE_DATE: 'dueDateColumn',
        DUE_TIME: 'dueTimeColumn',
        COMPLETED_DATE: 'completedDateColumn',
        CREATED_DATE: 'createdDateColumn',
        LAST_UPDATED: 'lastUpdatedColumn',
        REPORTER: 'reporterColumn',
      };

      const translationKey = keyMappings[fieldKey];
      return translationKey ? tTable(translationKey) : fieldKey;
    },
    [tTable]
  );

  const fieldsRaw = useSelector((state: RootState) => state.taskManagementFields);
  const columns = useSelector(selectColumns);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const fields = Array.isArray(fieldsRaw) ? fieldsRaw : fieldsRaw?.fields || [];
  const sortedFields = useMemo(() => [...fields].sort((a, b) => a.order - b.order), [fields]);
  const [open, setOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSaveFields = useMemo(
    () =>
      createDebouncedFunction((fieldsToSave: typeof fields) => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fieldsToSave));
      }, 300),
    [createDebouncedFunction]
  );

  useEffect(() => {
    debouncedSaveFields(fields);
    return () => debouncedSaveFields.cancel();
  }, [fields, debouncedSaveFields]);

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

  const visibleCount = useMemo(
    () => sortedFields.filter(field => field.visible).length,
    [sortedFields]
  );

  const fieldsTitle = useMemo(() => {
    return visibleCount > 0
      ? t('fieldsWithCount', {
          count: visibleCount,
          defaultValue: 'Fields: {{count}}',
        })
      : t('fieldsText', { defaultValue: 'Fields' });
  }, [visibleCount, t]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        title={fieldsTitle}
        aria-label={fieldsTitle}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
          border transition-all duration-200 ease-in-out
          ${
            visibleCount > 0
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
        <EyeOutlined className="w-3.5 h-3.5" />
        <span>{t('fieldsText', { defaultValue: 'Fields' })}</span>
        {visibleCount > 0 && (
          <span
            className={`inline-flex items-center justify-center w-4 h-4 text-xs font-bold ${isDarkMode ? 'text-white bg-gray-500' : 'text-gray-800 bg-gray-300'} rounded-full`}
          >
            {visibleCount}
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
          <div className="max-h-48 overflow-y-auto">
            {sortedFields.length === 0 ? (
              <div className={`p-2 text-xs text-center ${themeClasses.secondaryText}`}>
                {t('noOptionsFound', { defaultValue: 'No Options Found' })}
              </div>
            ) : (
              <div className="p-0.5">
                {sortedFields.map(field => {
                  const isSelected = field.visible;

                  return (
                    <button
                      key={field.key}
                      onClick={() => {
                        dispatch(toggleField(field.key));

                        if (projectId) {
                          dispatch(
                            syncFieldWithDatabase({
                              projectId,
                              fieldKey: field.key,
                              visible: !field.visible,
                              columns,
                            })
                          );
                        }
                      }}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded
                        transition-colors duration-150 text-left
                        ${
                          isSelected
                            ? isDarkMode
                              ? 'text-white font-semibold'
                              : 'text-gray-800 font-semibold'
                            : `${themeClasses.optionText} ${themeClasses.optionHover}`
                        }
                      `}
                    >
                      <div
                        className={`
                          flex items-center justify-center w-3.5 h-3.5 border rounded
                          ${
                            isSelected
                              ? 'bg-gray-600 border-gray-600 text-white'
                              : 'border-gray-300 dark:border-gray-600'
                          }
                        `}
                      >
                        {isSelected && <CheckOutlined className="w-2.5 h-2.5" />}
                      </div>

                      <div className="flex-1 flex items-center justify-between">
                        <span className="truncate">{getFieldLabel(field.key)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
