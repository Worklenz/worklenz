import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircleOutlined, HolderOutlined, InputNumber, Popover, Button, Flex, Typography, Tooltip } from '@/shared/antd-imports';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/shared/antd-imports';
import { Task } from '@/types/task-management.types';
import AssigneeSelector from '@/components/AssigneeSelector';
import { format } from 'date-fns';
import AvatarGroup from '../../AvatarGroup';
import { DEFAULT_TASK_NAME } from '@/shared/constants';
import TaskProgress from './TaskProgress';
import TaskStatusDropdown from '@/components/task-management/task-status-dropdown';
import TaskPriorityDropdown from '@/components/task-management/task-priority-dropdown';
import TaskPhaseDropdown from '@/components/task-management/task-phase-dropdown';
import TaskTimeTracking from '../TaskTimeTracking';
import { CustomNumberLabel, CustomColordLabel } from '@/components';
import LabelsSelector from '@/components/LabelsSelector';
import { CustomColumnCell } from './CustomColumnComponents';
import { safeTextDisplay } from '@/utils/html-entities';

// Utility function to get task display name with fallbacks
export const getTaskDisplayName = (task: Task): string => {
  if (task.title && task.title.trim()) return safeTextDisplay(task.title.trim());
  if (task.name && task.name.trim()) return safeTextDisplay(task.name.trim());
  if (task.task_key && task.task_key.trim()) return safeTextDisplay(task.task_key.trim());
  return DEFAULT_TASK_NAME;
};

// Memoized date formatter to avoid repeated date parsing
// Parse date as local date to avoid timezone issues (e.g., "2024-02-10" should display as Feb 10, not Feb 9)
export const formatDate = (dateString: string): string => {
  try {
    // Full ISO timestamp with timezone (e.g. "2024-02-10T22:30:00.000Z" from updated_at / created_at):
    // Let the Date constructor parse it as UTC, then read back the local year/month/day.
    // This correctly handles cases where the UTC date differs from the user's local date
    // (e.g. 11:30 PM UTC = next day in UTC+5:30).
    if (dateString.includes('T')) {
      const d = new Date(dateString);
      return format(d, 'MMM d, yyyy'); // date-fns formats using local timezone by default
    }

    // Date-only string ("YYYY-MM-DD") from start_date / end_date (stored as DATE type in DB):
    // Parse as local date to avoid UTC midnight shifting the date backward in negative-offset zones.
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return format(date, 'MMM d, yyyy');
  } catch {
    return '';
  }
};

interface TaskLabelsCellProps {
  labels: Task['labels'];
  isDarkMode: boolean;
}

export const TaskLabelsCell: React.FC<TaskLabelsCellProps> = memo(({ labels, isDarkMode }) => {
  if (!labels) {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5" style={{ flexShrink: 0 }}>
      {labels.map((label, index) => {
        const extendedLabel = label as any;
        return extendedLabel.end && extendedLabel.names && extendedLabel.name ? (
          <CustomNumberLabel
            key={`${label.id}-${index}`}
            labelList={extendedLabel.names}
            namesString={extendedLabel.name}
            isDarkMode={isDarkMode}
            color={label.color}
          />
        ) : (
          <CustomColordLabel key={`${label.id}-${index}`} label={label} isDarkMode={isDarkMode} />
        );
      })}
    </div>
  );
});

TaskLabelsCell.displayName = 'TaskLabelsCell';

interface DragHandleColumnProps {
  width: string;
  isSubtask: boolean;
  attributes: any;
  listeners: any;
}

export const DragHandleColumn: React.FC<DragHandleColumnProps> = memo(
  ({ width, isSubtask, attributes, listeners }) => (
    <div
      className="flex items-center justify-center pl-1 h-full w-full"
      {...(isSubtask ? {} : { ...attributes, ...listeners })}
    >
      {!isSubtask && <HolderOutlined className="text-gray-400 hover:text-gray-600" />}
    </div>
  )
);

DragHandleColumn.displayName = 'DragHandleColumn';

interface CheckboxColumnProps {
  width: string;
  isSelected: boolean;
  onCheckboxChange: (e: any) => void;
}

export const CheckboxColumn: React.FC<CheckboxColumnProps> = memo(
  ({ width, isSelected, onCheckboxChange }) => (
    <div className="flex items-center justify-center h-full w-full dark:border-gray-700">
      <Checkbox
        checked={isSelected}
        onChange={onCheckboxChange}
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
);

CheckboxColumn.displayName = 'CheckboxColumn';

interface TaskKeyColumnProps {
  width: string;
  taskKey: string;
}

export const TaskKeyColumn: React.FC<TaskKeyColumnProps> = memo(({ width, taskKey }) => (
  <div
    className="flex items-center pl-3 border-r border-gray-200 dark:border-gray-700"
    style={{ width }}
  >
    <span className="text-xs font-medium px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap border border-gray-200 dark:border-gray-600">
      {taskKey || 'N/A'}
    </span>
  </div>
));

TaskKeyColumn.displayName = 'TaskKeyColumn';

interface DescriptionColumnProps {
  width: string;
  description: string;
  taskId: string;
  parentTaskId?: string | null;
  onOpenDrawer?: () => void;
}

/** Strip HTML tags to plain text for display and editing in the task list cell. */
const stripHtml = (html: string): string => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

/**
 * Returns true when the description contains HTML formatting that would be
 * lost if edited as plain text (lists, bold, italic, links, etc.).
 * A bare <p> with no attributes is treated as plain text — Quill wraps
 * everything in <p> tags, so we only flag it when there is actual markup
 * beyond a single plain paragraph.
 */
const hasRichFormatting = (html: string): boolean => {
  if (!html) return false;
  // Tags that carry formatting beyond a plain paragraph
  const richTags = /<(ol|ul|li|strong|em|u|s|a|h[1-6]|blockquote|pre|code)\b/i;
  if (richTags.test(html)) return true;
  // Multiple <p> blocks = multi-paragraph content worth preserving
  const paragraphCount = (html.match(/<p[\s>]/gi) || []).length;
  return paragraphCount > 1;
};

export const DescriptionColumn: React.FC<DescriptionColumnProps> = memo(
  ({ width, description, taskId, parentTaskId, onOpenDrawer }) => {
    const { socket, connected } = useSocket();
    const { t } = useTranslation('task-list-table');

    const plainText = stripHtml(description);
    const isRich = hasRichFormatting(description);

    const [isEditing, setIsEditing] = useState(false);
    // Draft holds the plain-text value while the input is open.
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    // Keep a stable ref to the original plain text so we can detect changes on save.
    const originalRef = useRef('');

    const openEditor = useCallback(() => {
      // If the description has rich formatting (lists, bold, etc.), editing as
      // plain text would silently destroy it. Redirect to the task drawer instead.
      if (isRich) {
        onOpenDrawer?.();
        return;
      }
      originalRef.current = plainText;
      setDraft(plainText);
      setIsEditing(true);
    }, [isRich, plainText, onOpenDrawer]);

    // Focus the input after it mounts.
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        // Place cursor at end of text.
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }, [isEditing]);

    const saveAndClose = useCallback(() => {
      const trimmed = draft.trim();
      // Only emit if the value actually changed.
      if (trimmed !== originalRef.current.trim() && connected && socket && taskId) {
        socket.emit(
          SocketEvents.TASK_DESCRIPTION_CHANGE.toString(),
          JSON.stringify({
            task_id: taskId,
            description: trimmed || null,
            parent_task: parentTaskId || null,
          })
        );
      }
      setIsEditing(false);
    }, [draft, connected, socket, taskId, parentTaskId]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
          setIsEditing(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          saveAndClose();
        }
      },
      [saveAndClose]
    );

    if (isEditing) {
      return (
        <div
          className="flex items-center"
          style={{
            width,
            flexShrink: 0,
            height: '40px',
            padding: '0 4px',
            // Border lives on the wrapper so the native input focus ring never shows.
            border: '1px solid #1677ff',
            borderRadius: '3px',
            boxShadow: '0 0 0 2px rgba(22, 119, 255, 0.1)',
            boxSizing: 'border-box',
          }}
          onClick={e => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={saveAndClose}
            onKeyDown={handleKeyDown}
            placeholder={t('descriptionPlaceholder', { defaultValue: 'Add description…' })}
            style={{
              width: '100%',
              height: '100%',
              fontSize: '13px',
              lineHeight: '22px',
              padding: '0 4px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'inherit',
              boxShadow: 'none',
              // Suppress any browser UA stylesheet focus styles.
              WebkitAppearance: 'none',
            }}
          />
        </div>
      );
    }

    return (
      <Tooltip
        title={
          isRich
            ? t('descriptionRichTooltip', { defaultValue: 'Contains rich formatting — click to edit in task drawer' })
            : undefined
        }
        placement="top"
        mouseEnterDelay={0.5}
      >
        <div
          className="flex items-center px-2 border-r border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden single-line-scroll cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          style={{
            width,
            height: '40px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          onClick={e => {
            e.stopPropagation();
            openEditor();
          }}
          title={!isRich ? (plainText.trim() || t('descriptionPlaceholder', { defaultValue: 'Add description…' })) : undefined}
        >
          {plainText.trim() ? (
            <span
              className="text-sm text-gray-600 dark:text-gray-400"
              style={{ whiteSpace: 'nowrap', display: 'inline-block' }}
            >
              {plainText}
            </span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {t('descriptionPlaceholder', { defaultValue: 'Add description…' })}
            </span>
          )}
        </div>
      </Tooltip>
    );
  }
);

DescriptionColumn.displayName = 'DescriptionColumn';

interface StatusColumnProps {
  width: string;
  task: Task;
  projectId: string;
  isDarkMode: boolean;
}

export const StatusColumn: React.FC<StatusColumnProps> = memo(
  ({ width, task, projectId, isDarkMode }) => (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      <TaskStatusDropdown task={task} projectId={projectId} isDarkMode={isDarkMode} />
    </div>
  )
);

StatusColumn.displayName = 'StatusColumn';

interface AssigneesColumnProps {
  width: string;
  task: Task;
  convertedTask: any;
  isDarkMode: boolean;
  canCreateTask?: boolean;
}

export const AssigneesColumn: React.FC<AssigneesColumnProps> = memo(
  ({ width, task, convertedTask, isDarkMode, canCreateTask = true }) => {
    const hasAssignees = (task.assignee_names || []).length > 0;

    return (
      <div
        className="flex items-center gap-1 px-2 border-r border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden single-line-scroll"
        style={{ 
          width,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-1" style={{ flexShrink: 0, minWidth: 'max-content' }}>
          {hasAssignees ? (
            // When assignees exist: avatars act as the trigger, no plus button
            <AssigneeSelector
              task={convertedTask}
              groupId={null}
              isDarkMode={isDarkMode}
              disabled={!canCreateTask}
              triggerElement={
                <AvatarGroup
                  members={task.assignee_names || []}
                  maxCount={3}
                  isDarkMode={isDarkMode}
                  size={24}
                />
              }
            />
          ) : (
            // When no assignees: show only the plus button
            canCreateTask && <AssigneeSelector task={convertedTask} groupId={null} isDarkMode={isDarkMode} />
          )}
        </div>
      </div>
    );
  }
);

AssigneesColumn.displayName = 'AssigneesColumn';

interface PriorityColumnProps {
  width: string;
  task: Task;
  projectId: string;
  isDarkMode: boolean;
}

export const PriorityColumn: React.FC<PriorityColumnProps> = memo(
  ({ width, task, projectId, isDarkMode }) => (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      <TaskPriorityDropdown task={task} projectId={projectId} isDarkMode={isDarkMode} />
    </div>
  )
);

PriorityColumn.displayName = 'PriorityColumn';

interface ProgressColumnProps {
  width: string;
  task: Task;
}

export const ProgressColumn: React.FC<ProgressColumnProps> = memo(({ width, task }) => {
  // Add defensive fallback like TaskProgressCircle to handle both complete_ratio and progress fields
  const progress =
    typeof task.complete_ratio === 'number'
      ? task.complete_ratio
      : typeof task.progress === 'number'
        ? task.progress
        : 0;

  return (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      {progress !== undefined &&
        progress >= 0 &&
        (progress === 100 ? (
          <div className="flex items-center justify-center">
            <CheckCircleOutlined
              className="text-green-500"
              style={{
                fontSize: '20px',
                color: '#52c41a',
              }}
            />
          </div>
        ) : (
          <TaskProgress progress={progress} numberOfSubTasks={task.sub_tasks?.length || 0} />
        ))}
    </div>
  );
});

ProgressColumn.displayName = 'ProgressColumn';

interface LabelsColumnProps {
  width: string;
  task: Task;
  labelsAdapter: any;
  isDarkMode: boolean;
  visibleColumns: any[];
  columnId?: string;
}

export const LabelsColumn: React.FC<LabelsColumnProps> = memo(
  ({ width, task, labelsAdapter, isDarkMode, visibleColumns, columnId = 'labels' }) => {
    const labelsStyle = {
      width,
      flexShrink: 0,
    };

    return (
      <div
        className="flex items-center px-2 border-r border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden labels-scroll-container"
        style={{
          ...labelsStyle,
          // Enable horizontal scrolling for labels - GitHub style (hidden scrollbar)
          scrollbarWidth: 'none', // For Firefox - hide scrollbar
          msOverflowStyle: 'none', // For IE/Edge - hide scrollbar
          WebkitOverflowScrolling: 'touch', // For iOS smooth scrolling
          whiteSpace: 'nowrap', // Prevent wrapping
        }}
      >
        <div className="flex items-center gap-0.5" style={{ flexShrink: 0, minWidth: 'max-content' }}>
          <TaskLabelsCell labels={task.labels} isDarkMode={isDarkMode} />
          <LabelsSelector task={labelsAdapter} isDarkMode={isDarkMode} />
        </div>
      </div>
    );
  }
);

LabelsColumn.displayName = 'LabelsColumn';

interface PhaseColumnProps {
  width: string;
  task: Task;
  projectId: string;
  isDarkMode: boolean;
}

export const PhaseColumn: React.FC<PhaseColumnProps> = memo(
  ({ width, task, projectId, isDarkMode }) => (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      <TaskPhaseDropdown task={task} projectId={projectId} isDarkMode={isDarkMode} />
    </div>
  )
);

PhaseColumn.displayName = 'PhaseColumn';

interface TimeTrackingColumnProps {
  width: string;
  taskId: string;
  isDarkMode: boolean;
}

export const TimeTrackingColumn: React.FC<TimeTrackingColumnProps> = memo(
  ({ width, taskId, isDarkMode }) => (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      <TaskTimeTracking taskId={taskId} isDarkMode={isDarkMode} />
    </div>
  )
);

TimeTrackingColumn.displayName = 'TimeTrackingColumn';

interface EstimationColumnProps {
  width: string;
  task: Task;
}

export const EstimationColumn: React.FC<EstimationColumnProps> = memo(({ width, task }) => {
  const { socket, connected } = useSocket();
  const { t } = useTranslation(['task-drawer/task-drawer', 'common']);
  
  const estimatedHours = task.timeTracking?.estimated || 0;
  const initialHours = Math.floor(estimatedHours);
  const initialMinutes = Math.round((estimatedHours - initialHours) * 60);

  const [hours, setHours] = useState<number | null>(initialHours > 0 ? initialHours : null);
  const [minutes, setMinutes] = useState<number | null>(initialMinutes > 0 ? initialMinutes : null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const newVal = task.timeTracking?.estimated || 0;
    const h = Math.floor(newVal);
    const m = Math.round((newVal - h) * 60);
    setHours(h > 0 ? h : null);
    setMinutes(m > 0 ? m : null);
  }, [task.timeTracking?.estimated]);

  const handleSave = useCallback(() => {
    setIsOpen(false);
    if (!connected || !socket || !task.id) return;
    
    socket.emit(
      SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(),
      JSON.stringify({
        task_id: task.id,
        total_hours: hours || 0,
        total_minutes: minutes || 0,
        parent_task: task.parent_task_id || null,
      })
    );
  }, [connected, socket, task.id, task.parent_task_id, hours, minutes]);

  const popoverContent = (
    <div style={{ width: 280, padding: '4px 0' }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 16 }}>
        {t('taskInfoTab.details.time-estimation', { defaultValue: 'Time Estimation' })}
      </Typography.Text>
      
      <Flex gap={8} style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <Typography.Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 4 }}>
            {t('taskInfoTab.details.hours', { defaultValue: 'Hours' })}
          </Typography.Text>
          <InputNumber
            min={0}
            precision={0}
            value={hours}
            onChange={setHours}
            style={{ width: '100%' }}
            placeholder={t('taskInfoTab.details.hours', { defaultValue: 'Hours' })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Typography.Text style={{ color: '#8c8c8c', fontSize: 12, display: 'block', marginBottom: 4 }}>
            {t('taskInfoTab.details.minutes', { defaultValue: 'Minutes' })}
          </Typography.Text>
          <InputNumber
            min={0}
            max={59}
            precision={0}
            value={minutes}
            onChange={setMinutes}
            style={{ width: '100%' }}
            placeholder={t('taskInfoTab.details.minutes', { defaultValue: 'Minutes' })}
          />
        </div>
      </Flex>

      <Flex justify="flex-end" gap={8}>
        <Button size="small" onClick={() => setIsOpen(false)}>
          {t('common:common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button size="small" type="primary" onClick={handleSave}>
          {t('common:common.save', { defaultValue: 'Save' })}
        </Button>
      </Flex>
    </div>
  );

  const estimationDisplay = (() => {
    if (estimatedHours && estimatedHours > 0) {
      const h = Math.floor(estimatedHours);
      const m = Math.round((estimatedHours - h) * 60);

      if (h > 0 && m > 0) {
        return `${h}h ${m}m`;
      } else if (h > 0) {
        return `${h}h`;
      } else if (m > 0) {
        return `${m}m`;
      }
    }
    return null;
  })();

  return (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] cursor-pointer transition-colors"
      style={{ width }}
    >
      <Popover
        content={popoverContent}
        trigger="click"
        open={isOpen}
        onOpenChange={setIsOpen}
        placement="bottom"
        destroyTooltipOnHide
      >
        <div className="w-full h-full flex items-center justify-center min-h-[24px]">
          {estimationDisplay ? (
            <span className="text-sm text-gray-500 dark:text-gray-400">{estimationDisplay}</span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
          )}
        </div>
      </Popover>
    </div>
  );
});

EstimationColumn.displayName = 'EstimationColumn';

interface DateColumnProps {
  width: string;
  formattedDate: string | null;
  placeholder?: string;
}

export const DateColumn: React.FC<DateColumnProps> = memo(
  ({ width, formattedDate, placeholder = '-' }) => (
    <div
      className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
      style={{ width }}
    >
      {formattedDate ? (
        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {formattedDate}
        </span>
      ) : (
        <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {placeholder}
        </span>
      )}
    </div>
  )
);

DateColumn.displayName = 'DateColumn';

interface ReporterColumnProps {
  width: string;
  reporter: string;
}

export const ReporterColumn: React.FC<ReporterColumnProps> = memo(({ width, reporter }) => (
  <div
    className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden single-line-scroll"
    style={{ 
      width,
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      WebkitOverflowScrolling: 'touch',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}
  >
    {reporter ? (
      <span
        className="text-sm text-gray-500 dark:text-gray-400"
        style={{ whiteSpace: 'nowrap' }}
        title={safeTextDisplay(reporter)}
      >
        {safeTextDisplay(reporter)}
      </span>
    ) : (
      <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">-</span>
    )}
  </div>
));

ReporterColumn.displayName = 'ReporterColumn';

interface CustomColumnProps {
  width: string;
  column: any;
  task: Task;
  updateTaskCustomColumnValue?: (taskId: string, columnKey: string, value: string| number | boolean | string[] | null) => void;
}

export const CustomColumn: React.FC<CustomColumnProps> = memo(
  ({ width, column, task, updateTaskCustomColumnValue }) => {
    if (!updateTaskCustomColumnValue) return null;

    return (
      <div
        className="flex items-center px-2 border-r border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden single-line-scroll"
        style={{ 
          width,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <div style={{ width: '100%', minWidth: 0 }}>
          <CustomColumnCell
            column={column}
            task={task}
            updateTaskCustomColumnValue={updateTaskCustomColumnValue}
          />
        </div>
      </div>
    );
  }
);

CustomColumn.displayName = 'CustomColumn';


// Export the new overflow-aware labels column
export { LabelsColumnWithOverflow } from './LabelsColumnWithOverflow';
