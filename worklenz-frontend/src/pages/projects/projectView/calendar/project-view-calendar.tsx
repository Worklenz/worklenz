import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Badge, Spin, Tooltip, Typography, Empty } from '@/shared/antd-imports';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';

import './project-view-calendar.css';

const { Text } = Typography;

interface CalendarTask {
  id: string;
  name: string;
  statusColor: string;
  statusName: string;
  endDate: string;
}

const ProjectViewCalendar: React.FC = () => {
  const dispatch = useAppDispatch();
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs());

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await tasksApiService.getTaskListV3({
        id: projectId,
        archived: 'false',
        group: 'status',
        field: '',
        order: 'ASC',
        search: '',
        statuses: '',
        members: '',
        projects: '',
        isSubtasksInclude: 'false',
        labels: '',
        priorities: '',
        customColumns: 'false',
        include_empty: 'true',
      });

      if (res.done && res.body) {
        const allTasks: CalendarTask[] = [];
        const groups = (res.body as any).groups || res.body;
        for (const group of (Array.isArray(groups) ? groups : [])) {
          if (!group.tasks) continue;
          const groupColor = group.color || group.color_code || '#1890ff';
          const groupTitle = group.title || group.name || '';
          for (const task of group.tasks) {
            const endDate = task.dueDate || task.end_date;
            if (endDate && task.id) {
              allTasks.push({
                id: task.id,
                name: task.title || task.name || 'Untitled',
                statusColor: task.status_color || groupColor,
                statusName: task.status || groupTitle,
                endDate,
              });
            }
          }
        }
        setTasks(allTasks);
      }
    } catch (err) {
      console.error('Failed to fetch tasks for calendar', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Build a date → tasks map for O(1) lookup in cellRender
  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const task of tasks) {
      const dateKey = dayjs(task.endDate).format('YYYY-MM-DD');
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(task);
    }
    return map;
  }, [tasks]);

  const handleTaskClick = (taskId: string) => {
    dispatch(setSelectedTaskId(taskId));
    dispatch(setShowTaskDrawer(true));
  };

  const dateCellRender = (date: Dayjs) => {
    const dateKey = date.format('YYYY-MM-DD');
    const dayTasks = tasksByDate.get(dateKey);
    if (!dayTasks || dayTasks.length === 0) return null;

    const maxVisible = 3;
    const visible = dayTasks.slice(0, maxVisible);
    const overflow = dayTasks.length - maxVisible;

    return (
      <ul className="ppm-calendar-tasks">
        {visible.map(task => (
          <li key={task.id} onClick={(e) => { e.stopPropagation(); handleTaskClick(task.id); }}>
            <Tooltip title={`${task.name} — ${task.statusName}`}>
              <Badge
                color={task.statusColor}
                text={<Text ellipsis style={{ fontSize: 12, maxWidth: 120 }}>{task.name}</Text>}
              />
            </Tooltip>
          </li>
        ))}
        {overflow > 0 && (
          <li className="ppm-calendar-overflow">
            <Text type="secondary" style={{ fontSize: 11 }}>+{overflow} more</Text>
          </li>
        )}
      </ul>
    );
  };

  const cellRender = (current: Dayjs, info: { type: string }) => {
    if (info.type === 'date') return dateCellRender(current);
    return null;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (tasks.length === 0 && !loading) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="No tasks with due dates" />
        <Calendar
          className="ppm-project-calendar"
          value={currentMonth}
          onChange={setCurrentMonth}
        />
      </div>
    );
  }

  return (
    <div className="ppm-project-calendar-wrapper" style={{ padding: '0 16px' }}>
      <Calendar
        className="ppm-project-calendar"
        value={currentMonth}
        onChange={setCurrentMonth}
        cellRender={cellRender}
      />
    </div>
  );
};

export default ProjectViewCalendar;
