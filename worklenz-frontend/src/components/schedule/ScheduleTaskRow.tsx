import React, { useMemo } from 'react';
import { Tag, Avatar, Tooltip, Progress } from '@/shared/antd-imports';
import { ClockCircleOutlined, CalendarOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import dayjs from 'dayjs';

interface ScheduleTaskRowProps {
  task: {
    id: string;
    name: string;
    status?: string; // This is the status ID
    status_color?: string;
    labels?: Array<{ id: string; name: string; color_code: string }>;
    total_minutes?: number;
    phase_name?: string;
    phase_color?: string;
    priority?: string; // This is the priority name (low/medium/high)
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
        color: isDarkMode ? (statusById.color_code_dark || statusById.color_code) : statusById.color_code,
      };
    }
    
    // If not found by ID, try to find by name (case-insensitive)
    const statusByName = statusList.find(s => 
      s.name?.toLowerCase() === task.status?.toLowerCase()
    );
    if (statusByName) {
      return {
        name: statusByName.name || task.status,
        color: isDarkMode ? (statusByName.color_code_dark || statusByName.color_code) : statusByName.color_code,
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
        color: isDarkMode ? (priorityByValue.color_code_dark || priorityByValue.color_code) : priorityByValue.color_code,
      };
    }
    
    // Try to find by ID if task.priority is actually an ID
    const priorityById = priorityList.find(p => p.id === task.priority);
    if (priorityById) {
      // Map value back to name
      const value = Number(priorityById.value);
      const name = value === 0 ? 'Low' : value === 1 ? 'Medium' : value === 2 ? 'High' : task.priority;
      return {
        name: name,
        color: isDarkMode ? (priorityById.color_code_dark || priorityById.color_code) : priorityById.color_code,
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

  // Format logged time
  const loggedTime = useMemo(() => {
    if (!task.total_minutes) return '0h';
    const hours = Math.floor(task.total_minutes / 60);
    const minutes = task.total_minutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }, [task.total_minutes]);

  // Format dates
  const formattedStartDate = task.start_date
    ? dayjs(task.start_date).format('MMM DD, YYYY')
    : '-';
  const formattedEndDate = task.end_date ? dayjs(task.end_date).format('MMM DD, YYYY') : '-';

  return (
    <div
      className={`flex items-center gap-3 p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
        isDarkMode ? 'bg-gray-900' : 'bg-white'
      }`}
      onClick={onClick}
      style={{ minHeight: '60px' }}
    >
      {/* Task Name - 30% width */}
      <div className="flex-[3] min-w-0">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {task.name}
          </span>
          {/* Progress bar */}
          {task.progress !== undefined && (
            <Progress
              percent={task.progress}
              size="small"
              strokeColor={task.progress === 100 ? '#52c41a' : '#1890ff'}
              showInfo={false}
              style={{ maxWidth: '200px' }}
            />
          )}
        </div>
      </div>

      {/* Status - 12% width */}
      <div className="flex-[1.2] min-w-0">
        {statusInfo && (
          <Tag
            color={statusInfo.color}
            style={{
              borderRadius: '4px',
              fontSize: '11px',
              padding: '2px 8px',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {statusInfo.name}
          </Tag>
        )}
      </div>

      {/* Labels - 15% width */}
      <div className="flex-[1.5] min-w-0">
        <div className="flex flex-wrap gap-1">
          {task.labels && task.labels.length > 0 ? (
            task.labels.slice(0, 2).map(label => (
              <Tag
                key={label.id}
                color={label.color_code}
                style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  maxWidth: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {label.name}
              </Tag>
            ))
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
          {task.labels && task.labels.length > 2 && (
            <Tag style={{ fontSize: '10px', padding: '1px 6px' }}>
              +{task.labels.length - 2}
            </Tag>
          )}
        </div>
      </div>

      {/* Logged Time - 10% width */}
      <div className="flex-[1] min-w-0">
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <ClockCircleOutlined style={{ fontSize: '12px' }} />
          <span>{loggedTime}</span>
        </div>
      </div>

      {/* Phase - 12% width */}
      <div className="flex-[1.2] min-w-0">
        {task.phase_name ? (
          <Tag
            color={task.phase_color || '#722ed1'}
            style={{
              borderRadius: '4px',
              fontSize: '11px',
              padding: '2px 8px',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {task.phase_name}
          </Tag>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </div>

      {/* Priority - 10% width */}
      <div className="flex-[1] min-w-0">
        {priorityInfo ? (
          <Tag
            color={priorityInfo.color}
            style={{
              borderRadius: '4px',
              fontSize: '11px',
              padding: '2px 8px',
              textTransform: 'capitalize',
            }}
          >
            {priorityInfo.name}
          </Tag>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </div>

      {/* Start Date - 12% width */}
      <div className="flex-[1.2] min-w-0">
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <CalendarOutlined style={{ fontSize: '12px' }} />
          <span className="truncate">{formattedStartDate}</span>
        </div>
      </div>

      {/* End Date - 12% width */}
      <div className="flex-[1.2] min-w-0">
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <CalendarOutlined style={{ fontSize: '12px' }} />
          <span className="truncate">{formattedEndDate}</span>
        </div>
      </div>

      {/* Assignees - 10% width */}
      <div className="flex-[1] min-w-0">
        {task.assignees && task.assignees.length > 0 ? (
          <Avatar.Group maxCount={3} size="small">
            {task.assignees.map((assignee, index) => (
              <Tooltip key={index} title={assignee.name}>
                <Avatar
                  size="small"
                  src={assignee.avatar_url}
                  style={{
                    backgroundColor: assignee.color_code || '#1890ff',
                    fontSize: '10px',
                  }}
                >
                  {!assignee.avatar_url && assignee.name?.charAt(0).toUpperCase()}
                </Avatar>
              </Tooltip>
            ))}
          </Avatar.Group>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </div>
    </div>
  );
};

export default ScheduleTaskRow;
