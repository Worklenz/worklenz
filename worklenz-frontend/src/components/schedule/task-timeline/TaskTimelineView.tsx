import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import { Spin, Empty, message, Flex, Button, Tooltip } from '@/shared/antd-imports';
import { CalendarOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import dayjs, { Dayjs } from 'dayjs';
import 'gantt-task-react/dist/index.css';

import {
  useFetchTaskTimelineQuery,
  useUpdateTaskDatesMutation,
  useFetchTimeOffQuery,
  useFetchScheduleMembersQuery,
} from '@/api/schedule/scheduleApi';

import TaskTimelineFilters from './TaskTimelineFilters';
import TimeOffCalendar from './TimeOffCalendar';
import { useScheduleSocketHandlers } from '@/hooks/useScheduleSocketHandlers';
import {
  transformTasksToGanttFormat,
  mapViewModeToGantt,
  getColumnWidth,
  TaskTimelineItem,
} from './taskTransformers';

// Socket.IO for real-time updates
import { useSocket } from '@/socket/socketContext';

interface TaskTimelineViewProps {
  type: 'week' | 'month';
  date: Date;
}

const TaskTimelineView: React.FC<TaskTimelineViewProps> = ({ type, date }) => {
  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  // Initialize schedule socket handlers for real-time updates
  useScheduleSocketHandlers();

  // Filter states
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [selectedPriorityId, setSelectedPriorityId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [isTimeOffModalVisible, setIsTimeOffModalVisible] = useState(false);

  // Calculate date range based on view type
  const calculatedDateRange = useMemo(() => {
    const startDate = dayjs(date);
    let endDate: Dayjs;

    if (type === 'week') {
      endDate = startDate.add(2, 'week');
    } else {
      endDate = startDate.add(1, 'month');
    }

    return {
      startDate: dateRange[0]?.format('YYYY-MM-DD') || startDate.format('YYYY-MM-DD'),
      endDate: dateRange[1]?.format('YYYY-MM-DD') || endDate.format('YYYY-MM-DD'),
    };
  }, [date, type, dateRange]);

  // RTK Query hooks
  const {
    data: taskData,
    isLoading: isTasksLoading,
    refetch: refetchTasks,
    error: taskError,
  } = useFetchTaskTimelineQuery({
    startDate: calculatedDateRange.startDate,
    endDate: calculatedDateRange.endDate,
    memberId: selectedMemberId || undefined,
    projectId: selectedProjectId || undefined,
    statusId: selectedStatusId || undefined,
    priorityId: selectedPriorityId || undefined,
  });

  const { data: membersData, isLoading: isMembersLoading } = useFetchScheduleMembersQuery();

  const { data: timeOffData } = useFetchTimeOffQuery({
    startDate: calculatedDateRange.startDate,
    endDate: calculatedDateRange.endDate,
  });

  const [updateTaskDates, { isLoading: isUpdating }] = useUpdateTaskDatesMutation();

  // Extract data
  const tasks = taskData?.body || [];
  const members = membersData?.body || [];
  const timeOffEntries = timeOffData?.body || [];

  // Extract unique projects from tasks for filter
  const projects = useMemo(() => {
    const projectMap = new Map<string, { id: string; name: string }>();
    tasks.forEach((task: TaskTimelineItem) => {
      if (!projectMap.has(task.project_id)) {
        projectMap.set(task.project_id, {
          id: task.project_id,
          name: task.project_name,
        });
      }
    });
    return Array.from(projectMap.values());
  }, [tasks]);

  // Transform tasks to Gantt format
  const ganttTasks = useMemo(() => {
    return transformTasksToGanttFormat(tasks, isDarkMode);
  }, [tasks, isDarkMode]);

  // View mode mapping
  const viewMode = mapViewModeToGantt(type);
  const columnWidth = getColumnWidth(viewMode);

  // Theme-aware colors
  const ganttColors = useMemo(
    () => ({
      todayColor: isDarkMode ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.1)',
      projectProgressColor: isDarkMode ? '#34d399' : '#10b981',
      projectBackgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.2)' : 'rgba(16, 185, 129, 0.1)',
    }),
    [isDarkMode]
  );

  // Handle task date change (drag-drop)
  const handleDateChange = useCallback(
    async (task: Task) => {
      // Skip project-level tasks
      if (task.id.startsWith('project-')) return;

      try {
        await updateTaskDates({
          taskId: task.id,
          start_date: task.start.toISOString(),
          end_date: task.end.toISOString(),
        }).unwrap();

        message.success(t('taskDatesUpdated', { defaultValue: 'Task dates updated' }));
      } catch (error: any) {
        message.error(
          error?.data?.message ||
            t('taskDatesError', { defaultValue: 'Failed to update task dates' })
        );
        // Refetch to restore original state
        refetchTasks();
      }
    },
    [updateTaskDates, refetchTasks, t]
  );

  // Handle task click
  const handleTaskClick = useCallback((task: Task) => {
    // Could open task details modal here
  }, []);

  // Handle progress change
  const handleProgressChange = useCallback((task: Task) => {
    // Progress changes could be handled here if needed
  }, []);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSelectedProjectId(null);
    setSelectedMemberId(null);
    setSelectedStatusId(null);
    setSelectedPriorityId(null);
    setDateRange([null, null]);
  }, []);

  // Socket.IO real-time updates
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleTaskUpdate = (data: any) => {
      refetchTasks();
    };

    // Use our comprehensive socket handlers instead of individual ones
    // The useScheduleSocketHandlers hook will handle all task-related events
    // and invalidate the appropriate RTK Query cache, which will trigger refetch

    return () => {
      // Cleanup is handled by useScheduleSocketHandlers
    };
  }, [socket, refetchTasks]);

  // Loading state
  if (isTasksLoading || isMembersLoading) {
    return (
      <Flex justify="center" align="center" style={{ height: 400 }}>
        <Spin size="large" tip={t('loadingTimeline', { defaultValue: 'Loading timeline...' })} />
      </Flex>
    );
  }

  // Error state
  if (taskError) {
    return (
      <Flex justify="center" align="center" style={{ height: 400 }}>
        <Empty
          description={t('timelineError', { defaultValue: 'Failed to load timeline' })}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button onClick={() => refetchTasks()}>{t('retry', { defaultValue: 'Retry' })}</Button>
        </Empty>
      </Flex>
    );
  }

  return (
    <div className="task-timeline-view">
      {/* Filters */}
      <TaskTimelineFilters
        projects={projects}
        members={members.map((m: any) => ({ id: m.team_member_id || m.id, name: m.name }))}
        selectedProjectId={selectedProjectId}
        selectedMemberId={selectedMemberId}
        selectedStatusId={selectedStatusId}
        selectedPriorityId={selectedPriorityId}
        dateRange={dateRange}
        onProjectChange={setSelectedProjectId}
        onMemberChange={setSelectedMemberId}
        onStatusChange={setSelectedStatusId}
        onPriorityChange={setSelectedPriorityId}
        onDateRangeChange={setDateRange}
        onClearFilters={handleClearFilters}
        isLoading={isTasksLoading}
      />

      {/* Action Buttons */}
      <Flex justify="flex-end" gap={8} style={{ marginBottom: 16 }}>
        <Tooltip title={t('manageTimeOff', { defaultValue: 'Manage Time-Off' })}>
          <Button icon={<CalendarOutlined />} onClick={() => setIsTimeOffModalVisible(true)}>
            {t('timeOff', { defaultValue: 'Time-Off' })}
          </Button>
        </Tooltip>
        <Tooltip title={t('refresh', { defaultValue: 'Refresh' })}>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetchTasks()}
            loading={isTasksLoading}
          />
        </Tooltip>
      </Flex>

      {/* Gantt Chart */}
      {ganttTasks.length > 0 ? (
        <div
          style={{
            backgroundColor: themeWiseColor('#fff', '#141414', themeMode),
            borderRadius: 8,
            border: `1px solid ${themeWiseColor('#e5e7eb', '#303030', themeMode)}`,
            overflow: 'hidden',
          }}
        >
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            onDateChange={handleDateChange}
            onProgressChange={handleProgressChange}
            onDoubleClick={handleTaskClick}
            listCellWidth=""
            columnWidth={columnWidth}
            todayColor={ganttColors.todayColor}
            projectProgressColor={ganttColors.projectProgressColor}
            projectBackgroundColor={ganttColors.projectBackgroundColor}
            barCornerRadius={4}
            handleWidth={8}
          />
        </div>
      ) : (
        <Flex
          justify="center"
          align="center"
          style={{
            height: 300,
            backgroundColor: themeWiseColor('#fafafa', '#1f1f1f', themeMode),
            borderRadius: 8,
          }}
        >
          <Empty
            description={t('noTasksInRange', {
              defaultValue: 'No tasks found in the selected date range',
            })}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Flex>
      )}

      {/* Time-Off Modal */}
      <TimeOffCalendar
        members={members.map((m: any) => ({ id: m.team_member_id || m.id, name: m.name }))}
        visible={isTimeOffModalVisible}
        onClose={() => setIsTimeOffModalVisible(false)}
        dateRange={[calculatedDateRange.startDate, calculatedDateRange.endDate]}
      />

      {/* Loading overlay for updates */}
      {isUpdating && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <Spin size="large" />
        </div>
      )}
    </div>
  );
};

export default TaskTimelineView;
