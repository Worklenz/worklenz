import React, { useMemo } from 'react';
import { Tag, Tooltip } from '@/shared/antd-imports';
import { ClockCircleOutlined, ArrowsAltOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import dayjs from 'dayjs';

interface ScheduleTaskRowProps {
  task: {
    id: string;
    name: string;
    task_key?: string;
    status?: string;
    status_color?: string;
    labels?: Array<{ id: string; name: string; color_code: string }>;
    total_minutes?: number;
    total_minutes_spent?: number;
    phase_name?: string;
    phase_color?: string;
    priority?: string;
    priority_color?: string;
    start_date?: string;
    end_date?: string;
    progress?: number;
    assignees?: Array<{ name: string; avatar_url?: string; color_code?: string }>;
  };
  onClick?: () => void;
}

const ScheduleTaskRow: React.FC<ScheduleTaskRowProps> = ({ task, onClick }) => {
  const { t } = useTranslation('schedule');
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  // Get status list from Redux to map status ID to name
  const statusList = useAppSelector(state => state.taskStatusReducer.status);

  // Get priority list from Redux to map priority name to color
  const priorityList = useAppSelector(state => state.priorityReducer?.priorities || []);

  // Find status name from status ID or use the value directly if it's already a name
  const statusInfo = useMemo(() => {
    if (!task.status) return null;

    // First, try to find by ID
    const statusById = statusList.find(s => s.id === task.status);
    if (statusById) {
      return {
        name: statusById.name || task.status,
        color: isDarkMode
          ? statusById.color_code_dark || statusById.color_code
          : statusById.color_code,
      };
    }

    // If not found by ID, try to find by name (case-insensitive)
    const statusByName = statusList.find(s => s.name?.toLowerCase() === task.status?.toLowerCase());
    if (statusByName) {
      return {
        name: statusByName.name || task.status,
        color: isDarkMode
          ? statusByName.color_code_dark || statusByName.color_code
          : statusByName.color_code,
      };
    }

    // Fallback: use the task.status value as-is (might be a name already)
    return {
      name: task.status,
      color: task.status_color || '#1890ff',
    };
  }, [task.status, task.status_color, statusList, isDarkMode]);

  // Find priority color from priority name or ID
  const priorityInfo = useMemo(() => {
    if (!task.priority) return null;

    const priorityName = task.priority.toLowerCase();

    // Try to find by matching priority value to name
    const priorityByValue = priorityList.find(p => {
      // Map priority value to name: 0=low, 1=medium, 2=high
      const value = Number(p.value);
      if (value === 0 && priorityName === 'low') return true;
      if (value === 1 && priorityName === 'medium') return true;
      if (value === 2 && priorityName === 'high') return true;
      return false;
    });

    if (priorityByValue) {
      return {
        name: task.priority,
        color: isDarkMode
          ? priorityByValue.color_code_dark || priorityByValue.color_code
          : priorityByValue.color_code,
      };
    }

    // Try to find by ID if task.priority is actually an ID
    const priorityById = priorityList.find(p => p.id === task.priority);
    if (priorityById) {
      // Map value back to name
      const value = Number(priorityById.value);
      const name =
        value === 0 ? 'Low' : value === 1 ? 'Medium' : value === 2 ? 'High' : task.priority;
      return {
        name: name,
        color: isDarkMode
          ? priorityById.color_code_dark || priorityById.color_code
          : priorityById.color_code,
      };
    }

    // Fallback colors
    const fallbackColors: Record<string, string> = {
      high: '#ff4d4f',
      medium: '#faad14',
      low: '#52c41a',
    };

    return {
      name: task.priority,
      color: task.priority_color || fallbackColors[priorityName] || '#d9d9d9',
    };
  }, [task.priority, task.priority_color, priorityList, isDarkMode]);

  // Format estimation time (total_minutes)
  const estimationTime = useMemo(() => {
    const minutes = task.total_minutes ?? 0;
    if (minutes === 0) return '0h';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60); // Round the remaining minutes to avoid decimals
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, [task.total_minutes]);

  // Format logged time (total_minutes_spent)
  const loggedTime = useMemo(() => {
    const minutes = task.total_minutes_spent ?? 0;
    if (minutes === 0) return '0h';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60); // Round the remaining minutes to avoid decimals
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, [task.total_minutes_spent]);

  // Format dates
  const formattedStartDate = task.start_date ? dayjs(task.start_date).format('MMM DD, YYYY') : '-';
  const formattedEndDate = task.end_date ? dayjs(task.end_date).format('MMM DD, YYYY') : '-';

  return (
    <div
      className={`flex items-center min-w-max px-1 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer group`}
      onClick={onClick}
      style={{ height: '40px', minHeight: '40px' }}
    >
      {/* Task Key - 10% width */}
      <div
        className="flex-[1] min-w-0 px-2 border-r border-gray-200 dark:border-gray-700"
        style={{ height: '100%' }}
      >
        <div className="flex items-center h-full">
          <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
            {task.task_key || '-'}
          </span>
        </div>
      </div>

      {/* Task Name - 35% width */}
      <div
        className="flex-[3.5] min-w-0 px-2 border-r border-gray-200 dark:border-gray-700 relative"
        style={{ height: '100%' }}
      >
        <div className="flex items-center h-full gap-2 pr-0 transition-[padding] duration-200 group-hover:pr-14">
          <span className="text-sm text-gray-900 dark:text-gray-100 truncate flex-1">
            {task.name}
          </span>
        </div>

        {/* Open Task Drawer Button */}
        <button
          className="pointer-events-none group-hover:pointer-events-auto focus-visible:pointer-events-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all duration-200 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer rounded-md shadow-sm hover:shadow-md flex items-center gap-1 absolute right-2 top-1/2 -translate-y-1/2"
          onClick={e => {
            e.stopPropagation();
            dispatch(setSelectedTaskId(task.id));
            dispatch(setShowTaskDrawer(true));
          }}
        >
          <ArrowsAltOutlined style={{ fontSize: '11px' }} />
          <span>{t('open', { defaultValue: 'Open' })}</span>
        </button>
      </div>

      {/* Status - 13% width */}
      <div
        className="flex-[1.3] min-w-0 flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
        style={{ height: '100%' }}
      >
        {statusInfo ? (
          <Tag
            color={statusInfo.color}
            style={{
              borderRadius: '12px',
              fontSize: '11px',
              padding: '2px 10px',
              margin: 0,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              border: 'none',
            }}
          >
            {statusInfo.name}
          </Tag>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </div>

      {/* Estimation - 11% width */}
      <div
        className="flex-[1.1] min-w-0 flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
        style={{ height: '100%' }}
      >
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <ClockCircleOutlined style={{ fontSize: '12px' }} />
          <span className="whitespace-nowrap">{estimationTime}</span>
        </div>
      </div>

      {/* Logged Time - 11% width */}
      <div
        className="flex-[1.1] min-w-0 flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
        style={{ height: '100%' }}
      >
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <ClockCircleOutlined style={{ fontSize: '12px' }} />
          <span className="whitespace-nowrap">{loggedTime}</span>
        </div>
      </div>

      {/* Priority - 10% width */}
      <div
        className="flex-[1] min-w-0 flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
        style={{ height: '100%' }}
      >
        {priorityInfo ? (
          <Tag
            color={priorityInfo.color}
            style={{
              borderRadius: '12px',
              fontSize: '11px',
              padding: '2px 10px',
              margin: 0,
              textTransform: 'capitalize',
              border: 'none',
            }}
          >
            {priorityInfo.name}
          </Tag>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </div>

      {/* Start Date - 13% width */}
      <div
        className="flex-[1.3] min-w-0 flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
        style={{ height: '100%' }}
      >
        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap truncate">
          {formattedStartDate}
        </span>
      </div>

      {/* End Date - 13% width */}
      <div
        className="flex-[1.3] min-w-0 flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
        style={{ height: '100%' }}
      >
        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap truncate">
          {formattedEndDate}
        </span>
      </div>
    </div>
  );
};

export default ScheduleTaskRow;
