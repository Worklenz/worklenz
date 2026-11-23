import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckOutlined, EyeOutlined } from '@/shared/antd-imports';
import { RootState } from '@/app/store';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setFields,
  syncFieldWithDatabase,
  toggleField,
  type TaskListField,
} from '@/features/task-management/taskListFields.slice';
import { selectColumns } from '@/features/task-management/task-management.selectors';
import { fetchTasksV3, toggleColumnVisibility } from '@/features/task-management/task-management.slice';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import { useTaskListMode } from '@/features/task-management/task-list-mode-context';
import { ThemeClasses } from './types';

const LOCAL_STORAGE_KEY = 'worklenz.taskManagement.fields';

/** Software-only columns that are not in the shared DEFAULT_FIELDS list. */
const SOFTWARE_EXTRA_FIELDS: TaskListField[] = [
  { key: 'EPIC', label: 'Epic', visible: true, order: 4 },
  { key: 'POINTS', label: 'Points', visible: true, order: 9 },
];

/** Fields that map to software backlog columns (incl. Labels). */
const SOFTWARE_BACKLOG_FIELD_KEYS = new Set([
  'STATUS',
  'EPIC',
  'ASSIGNEES',
  'LABELS',
  'PRIORITY',
  'POINTS',
]);

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
  const { socket } = useSocket();
  const projectType = useAppSelector(state => state.projectReducer.project?.project_type);
  const isSoftwareProject = isSoftwareProjectType(projectType);
  const listMode = useTaskListMode();
  const isSoftwareBacklog = isSoftwareProject && listMode === 'backlog';

  const getFieldLabel = useCallback(
    (fieldKey: string) => {
      const keyMappings: Record<string, string> = {
        KEY: 'keyColumn',
        DESCRIPTION: 'descriptionColumn',
        PROGRESS: 'progressColumn',
        ASSIGNEES: isSoftwareProject ? 'assigneeColumn' : 'assigneesColumn',
        LABELS: 'labelsColumn',
        ATTACHMENTS: 'attachmentsColumn',
        PHASE: isSoftwareProject ? 'sprintColumn' : 'phaseColumn',
        EPIC: 'epicColumn',
        POINTS: 'pointsColumn',
        COMMENTS: 'commentsColumn',
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

      const defaultLabels: Record<string, string> = {
        KEY: 'Key',
        DESCRIPTION: 'Description',
        PROGRESS: 'Progress',
        ASSIGNEES: isSoftwareProject ? 'Assignee' : 'Assignees',
        LABELS: 'Labels',
        ATTACHMENTS: 'Attachments',
        PHASE: isSoftwareProject ? 'Sprint' : 'Phase',
        EPIC: 'Epic',
        POINTS: 'Points',
        COMMENTS: 'Latest Comment',
        STATUS: 'Status',
        PRIORITY: 'Priority',
        TIME_TRACKING: 'Time Tracking',
        ESTIMATION: 'Estimation',
        START_DATE: 'Start Date',
        DUE_DATE: 'Due Date',
        DUE_TIME: 'Due Time',
        COMPLETED_DATE: 'Completed Date',
        CREATED_DATE: 'Created Date',
        LAST_UPDATED: 'Last Updated',
        REPORTER: 'Reporter',
      };

      const translationKey = keyMappings[fieldKey];
      return translationKey
        ? tTable(translationKey, { defaultValue: defaultLabels[fieldKey] || fieldKey })
        : fieldKey;
    },
    [isSoftwareProject, tTable]
  );

  const fieldsRaw = useSelector((state: RootState) => state.taskManagementFields);
  const columns = useSelector(selectColumns);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const fields = Array.isArray(fieldsRaw) ? fieldsRaw : fieldsRaw?.fields || [];

  // Ensure software projects can toggle Epic / Points (and Labels stays in the shared list).
  useEffect(() => {
    if (!isSoftwareProject) return;
    const knownKeys = new Set(fields.map(field => field.key));
    const missing = SOFTWARE_EXTRA_FIELDS.filter(field => !knownKeys.has(field.key));
    if (missing.length === 0) return;
    dispatch(setFields([...fields, ...missing]));
  }, [dispatch, fields, isSoftwareProject]);

  const sortedFields = useMemo(() => {
    const list = [...fields].sort((a, b) => a.order - b.order);
    if (!isSoftwareBacklog) return list;
    return list.filter(field => SOFTWARE_BACKLOG_FIELD_KEYS.has(field.key));
  }, [fields, isSoftwareBacklog]);
  const customFields = useMemo(() => {
    const customColumns = columns.filter(
      column => !!column.custom_column && !!column.key && column.key !== 'TASK'
    );

    const uniqueByKey = new Map<string, { key: string; label: string; visible: boolean }>();
    customColumns.forEach(column => {
      const key = column.key || '';
      if (!key || uniqueByKey.has(key)) return;
      uniqueByKey.set(key, {
        key,
        label: column.name || key,
        visible: !!column.pinned,
      });
    });

    return Array.from(uniqueByKey.values());
  }, [columns]);
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

  const visibleCount = useMemo(() => {
    const standardVisible = sortedFields.filter(field => field.visible).length;
    const customVisible = isSoftwareBacklog
      ? 0
      : customFields.filter(field => field.visible).length;
    return standardVisible + customVisible;
  }, [customFields, isSoftwareBacklog, sortedFields]);

  const handleFieldToggle = useCallback(
    (fieldKey: string, currentVisible: boolean, isCustomField = false) => {
      if (isCustomField) {
        // Keep custom field visibility in task-management state and sync via socket event.
        dispatch(toggleColumnVisibility(fieldKey));

        if (projectId) {
          const customColumn = columns.find(col => col.key === fieldKey && col.custom_column);
          if (customColumn?.id) {
            socket?.emit(SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(), {
              column_id: customColumn.id,
              project_id: projectId,
              is_visible: !currentVisible,
            });
          }
          if (!currentVisible) {
            dispatch(fetchTasksV3({ projectId, silent: true }));
          }
        }
        return;
      }

      dispatch(toggleField(fieldKey));

      if (projectId) {
        dispatch(
          syncFieldWithDatabase({
            projectId,
            fieldKey,
            visible: !currentVisible,
            columns,
          })
        );
        if (!currentVisible && (fieldKey === 'COMMENTS' || fieldKey === 'ATTACHMENTS')) {
          dispatch(fetchTasksV3({ projectId, silent: true }));
        }
      }
    },
    [columns, dispatch, projectId, socket]
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
          inline-flex h-[30px] box-border items-center ${isSoftwareProject ? 'justify-center gap-1 px-2' : 'gap-1.5 px-2.5'} py-0 text-xs font-medium rounded-md
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
        {!isSoftwareProject && (
          <span>{t('fieldsText', { defaultValue: 'Fields' })}</span>
        )}
        {visibleCount > 0 && (
          <span
            className={`inline-flex items-center justify-center w-4 h-4 text-xs font-bold ${isDarkMode ? 'text-white bg-gray-500' : 'text-gray-800 bg-gray-300'} rounded-full`}
          >
            {visibleCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-full right-[-8px] z-50 mt-1 w-56 max-w-[calc(100vw-16px)] ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}
        >
          <div className="max-h-48 overflow-y-auto">
            {sortedFields.length === 0 ? (
              <div className={`p-2 text-xs text-center ${themeClasses.secondaryText}`}>
                {t('noOptionsFound', { defaultValue: 'No Options Found' })}
              </div>
            ) : (
              <div className="p-0.5">
                <div
                  className={`px-2 py-1 text-[11px] uppercase tracking-wide ${themeClasses.secondaryText}`}
                >
                  {t('standardFieldsSection', { defaultValue: 'Standard fields' })}
                </div>
                {sortedFields.map(field => {
                  const isSelected = field.visible;

                  return (
                    <button
                      key={field.key}
                      onClick={() => handleFieldToggle(field.key, field.visible)}
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

                {!isSoftwareBacklog && customFields.length > 0 && (
                  <>
                    <div className={`my-1 border-t ${themeClasses.dropdownBorder}`} />
                    <div
                      className={`px-2 py-1 text-[11px] uppercase tracking-wide ${themeClasses.secondaryText}`}
                    >
                      {t('customFieldsSection', { defaultValue: 'Custom fields' })}
                    </div>
                    {customFields.map(field => {
                      const isSelected = field.visible;
                      return (
                        <button
                          key={field.key}
                          onClick={() => handleFieldToggle(field.key, field.visible, true)}
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
                            <span className="truncate">{field.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
