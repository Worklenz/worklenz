import { useMemo, useState, useCallback } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Typography,
  Popover,
  LeftOutlined,
  RightOutlined,
} from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  useGetTasksByDateRangeQuery,
  useGetProjectsByTeamQuery,
  useGetClientsLookupQuery,
} from '@/api/home-page/home-page.api.service';
import { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { IHomeCalendarTask } from '@/types/home/home-page.types';
import HomeAddTaskModal from '@/pages/home/task-list/HomeAddTaskModal';
import PillToggle from '@/pages/home/PillToggle';
import MultiSelectFilterDropdown from './MultiSelectFilterDropdown';
import './homeCalendar.css';

dayjs.extend(isoWeek);

type CalendarViewType = 'month' | 'week' | 'year';

// Matches the status-category colors used by HomeProgressDonut so the calendar's
// todo/doing/done counts read consistently with the rest of the Home page.
const STATUS_CATEGORY_COLORS = { todo: '#faad14', doing: '#1677ff', done: '#52c41a' };

const HomeCalendar = () => {
  const { t } = useTranslation('home');
  const dispatch = useAppDispatch();
  const { homeTasksConfig } = useAppSelector(state => state.homePageReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  const WEEK_DAY_LABELS = useMemo(
    () => [
      t('homeCalendar.weekdayMon', { defaultValue: 'Mon' }),
      t('homeCalendar.weekdayTue', { defaultValue: 'Tue' }),
      t('homeCalendar.weekdayWed', { defaultValue: 'Wed' }),
      t('homeCalendar.weekdayThu', { defaultValue: 'Thu' }),
      t('homeCalendar.weekdayFri', { defaultValue: 'Fri' }),
      t('homeCalendar.weekdaySat', { defaultValue: 'Sat' }),
      t('homeCalendar.weekdaySun', { defaultValue: 'Sun' }),
    ],
    [t]
  );

  const MINI_WEEK_DAY_LABELS = useMemo(
    () => [
      t('homeCalendar.weekdayMiniMon', { defaultValue: 'M' }),
      t('homeCalendar.weekdayMiniTue', { defaultValue: 'T' }),
      t('homeCalendar.weekdayMiniWed', { defaultValue: 'W' }),
      t('homeCalendar.weekdayMiniThu', { defaultValue: 'T' }),
      t('homeCalendar.weekdayMiniFri', { defaultValue: 'F' }),
      t('homeCalendar.weekdayMiniSat', { defaultValue: 'S' }),
      t('homeCalendar.weekdayMiniSun', { defaultValue: 'S' }),
    ],
    [t]
  );

  const [calView, setCalView] = useState<CalendarViewType>('month');
  const [cursor, setCursor] = useState<Dayjs>(() => homeTasksConfig.selected_date || dayjs());
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterClients, setFilterClients] = useState<string[]>([]);
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Dayjs | null>(null);

  const rangeStart = useMemo(() => {
    if (calView === 'year') return cursor.startOf('year');
    if (calView === 'week') return cursor.startOf('isoWeek');
    return cursor.startOf('month').startOf('isoWeek');
  }, [calView, cursor]);

  const rangeEnd = useMemo(() => {
    if (calView === 'year') return cursor.endOf('year');
    if (calView === 'week') return cursor.endOf('isoWeek');
    return cursor.endOf('month').endOf('isoWeek');
  }, [calView, cursor]);

  const { data: tasksData } = useGetTasksByDateRangeQuery(
    {
      start_date: rangeStart.format('YYYY-MM-DD'),
      end_date: rangeEnd.format('YYYY-MM-DD'),
      group_by: homeTasksConfig.tasks_group_by || 0,
      time_zone: homeTasksConfig.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    { refetchOnMountOrArgChange: true }
  );

  const allTasks = tasksData?.body || [];

  // Team-scoped project list — independent of which tasks are currently
  // loaded, so projects with no due tasks in the visible range still show up.
  const { data: teamProjectsData, isFetching: projectsLoading } = useGetProjectsByTeamQuery();

  // Team-scoped client list — independent of which tasks are currently
  // loaded, so clients with no due tasks in the visible range still show up.
  const { data: clientsLookupData, isFetching: clientsLoading } = useGetClientsLookupQuery();

  const clientOptions = useMemo(() => {
    return (clientsLookupData?.body || [])
      .filter(client => client.id && client.name)
      .map(client => ({ value: client.id as string, label: client.name as string }));
  }, [clientsLookupData]);

  const statusOptions = useMemo(
    () => [
      { value: 'todo', label: t('tasks.todo', { defaultValue: 'Todo' }) },
      { value: 'doing', label: t('tasks.doing', { defaultValue: 'Doing' }) },
      { value: 'done', label: t('tasks.done', { defaultValue: 'Done' }) },
    ],
    [t]
  );

  const projectOptions = useMemo(() => {
    return (teamProjectsData?.body || [])
      .filter(project => project.id && project.name)
      .map(project => ({
        value: project.id as string,
        label: project.name as string,
        color: project.color_code,
      }));
  }, [teamProjectsData]);

  const anyFilterActive =
    filterStatuses.length > 0 || filterClients.length > 0 || filterProjects.length > 0;

  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => {
      if (filterStatuses.length) {
        const matchesCategory = filterStatuses.some(cat =>
          cat === 'todo' ? task.is_todo : cat === 'doing' ? task.is_doing : task.is_completed
        );
        if (!matchesCategory) return false;
      }
      if (filterClients.length && !filterClients.includes(task.client_id || '')) return false;
      if (filterProjects.length && !filterProjects.includes(task.project_id || '')) return false;
      return true;
    });
  }, [allTasks, filterStatuses, filterClients, filterProjects]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, IHomeCalendarTask[]>();
    filteredTasks.forEach(task => {
      if (!task.end_date) return;
      const key = dayjs(task.end_date).format('YYYY-MM-DD');
      const existing = map.get(key) || [];
      existing.push(task);
      map.set(key, existing);
    });
    return map;
  }, [filteredTasks]);

  const clearFilters = () => {
    setFilterStatuses([]);
    setFilterClients([]);
    setFilterProjects([]);
  };

  const goToday = () => setCursor(dayjs());
  const goPrev = () => setCursor(c => c.subtract(1, calView));
  const goNext = () => setCursor(c => c.add(1, calView));

  const openAddModal = useCallback((date: Dayjs) => {
    setModalDate(date);
    setModalOpen(true);
  }, []);

  const openTaskDrawer = useCallback(
    (task: IHomeCalendarTask) => {
      dispatch(setSelectedTaskId(task.id));
      dispatch(fetchTask({ taskId: task.id, projectId: task.project_id }));
      dispatch(setProjectId(task.project_id));
      dispatch(setShowTaskDrawer(true));
    },
    [dispatch]
  );

  const handleSelectDate = (date: Dayjs) => {
    dispatch(setHomeTasksConfig({ ...homeTasksConfig, selected_date: date }));
  };

  const handleTaskModeChange = (value: 'to' | 'by') => {
    dispatch(setHomeTasksConfig({ ...homeTasksConfig, tasks_group_by: value === 'by' ? 1 : 0 }));
  };

  const renderDaySummary = useCallback(
    (dayTasks: IHomeCalendarTask[], date: Dayjs) => {
      if (!dayTasks.length) return null;
      const todoTasks = dayTasks.filter(task => task.is_todo);
      const doingTasks = dayTasks.filter(task => task.is_doing);
      const doneTasks = dayTasks.filter(task => task.is_completed);

      const renderTaskList = (tasks: IHomeCalendarTask[]) => (
        <div className="home-calendar-day-popover-list">
          {tasks.map(task => (
            <div
              key={task.id}
              className="home-calendar-day-popover-item"
              onClick={e => {
                e.stopPropagation();
                openTaskDrawer(task);
              }}
            >
              <span
                className="home-calendar-day-popover-item-dot"
                style={{ backgroundColor: task.status_color || '#8c8c8c' }}
              />
              <span className="home-calendar-day-popover-item-name">{task.name}</span>
              {task.project_name && (
                <span className="home-calendar-day-popover-item-project">{task.project_name}</span>
              )}
            </div>
          ))}
        </div>
      );

      const renderSegment = (
        key: string,
        label: string,
        tasks: IHomeCalendarTask[],
        className: string,
        popoverTitle: string,
        style?: React.CSSProperties
      ) => (
        <Popover
          key={key}
          content={renderTaskList(tasks)}
          title={popoverTitle}
          trigger="hover"
          placement="bottom"
          mouseEnterDelay={0.2}
        >
          <span className={className} style={style} onClick={e => e.stopPropagation()}>
            {label} {tasks.length}
          </span>
        </Popover>
      );

      const hasBreakdown = todoTasks.length > 0 || doingTasks.length > 0 || doneTasks.length > 0;

      const dueTaskWord = (count: number) =>
        count === 1
          ? t('tasks.dueTask', { defaultValue: 'due task' })
          : t('tasks.dueTasks', { defaultValue: 'due tasks' });

      const todoLabel = t('tasks.todo', { defaultValue: 'Todo' });
      const doingLabel = t('tasks.doing', { defaultValue: 'Doing' });
      const doneLabel = t('tasks.done', { defaultValue: 'Done' });

      const totalDueTitle = `${t('tasks.total', { defaultValue: 'Total' })}: ${dayTasks.length} ${dueTaskWord(
        dayTasks.length
      )} ${t('tasks.on', { defaultValue: 'on' })} ${date.format('MMM D')}`;

      return (
        <div className="home-calendar-day-summary">
          <div className="home-calendar-day-summary-row">
            {renderSegment(
              'total',
              t('tasks.totalDue', { defaultValue: 'Total due' }),
              dayTasks,
              'home-calendar-day-summary-total',
              totalDueTitle
            )}
          </div>
          {hasBreakdown && (
            <div className="home-calendar-day-summary-row">
              {todoTasks.length > 0 &&
                renderSegment(
                  'todo',
                  todoLabel,
                  todoTasks,
                  'home-calendar-day-summary-segment',
                  `${todoLabel}: ${todoTasks.length} ${dueTaskWord(todoTasks.length)}`,
                  { color: STATUS_CATEGORY_COLORS.todo }
                )}
              {doingTasks.length > 0 &&
                renderSegment(
                  'doing',
                  doingLabel,
                  doingTasks,
                  'home-calendar-day-summary-segment',
                  `${doingLabel}: ${doingTasks.length} ${dueTaskWord(doingTasks.length)}`,
                  { color: STATUS_CATEGORY_COLORS.doing }
                )}
              {doneTasks.length > 0 &&
                renderSegment(
                  'done',
                  doneLabel,
                  doneTasks,
                  'home-calendar-day-summary-segment',
                  `${doneLabel}: ${doneTasks.length} ${dueTaskWord(doneTasks.length)}`,
                  { color: STATUS_CATEGORY_COLORS.done }
                )}
            </div>
          )}
        </div>
      );
    },
    [openTaskDrawer, t]
  );

  const navTitle =
    calView === 'year'
      ? cursor.format('YYYY')
      : calView === 'week'
        ? `${rangeStart.format('MMM D')} – ${rangeEnd.format('MMM D, YYYY')}`
        : cursor.format('MMMM YYYY');

  /* ── Month view ── */
  const renderMonth = () => {
    const start = cursor.startOf('month').startOf('isoWeek');
    const end = cursor.endOf('month').endOf('isoWeek');
    const days: Dayjs[] = [];
    let d = start;
    while (d.isBefore(end) || d.isSame(end, 'day')) {
      days.push(d);
      d = d.add(1, 'day');
    }
    const weeks: Dayjs[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    return (
      <div className="home-calendar-grid">
        <div className="home-calendar-weekday-row">
          {WEEK_DAY_LABELS.map((label, i) => (
            <div key={i} className="home-calendar-weekday-cell">
              {label}
            </div>
          ))}
        </div>
        <div className="home-calendar-month-body">
          {weeks.map((week, wi) => (
            <div key={wi} className="home-calendar-week-row">
              {week.map(date => {
                const inMonth = date.isSame(cursor, 'month');
                const isToday = date.isSame(dayjs(), 'day');
                const dateKey = date.format('YYYY-MM-DD');
                const dayTasks = tasksByDate.get(dateKey) || [];
                return (
                  <div
                    key={dateKey}
                    className={`home-calendar-day-cell ${inMonth ? '' : 'home-calendar-day-cell-muted'}`}
                    onClick={() => {
                      handleSelectDate(date);
                      openAddModal(date);
                    }}
                  >
                    <div className="home-calendar-day-header">
                      <span
                        className={`home-calendar-day-number ${isToday ? 'home-calendar-day-number-today' : ''}`}
                      >
                        {date.date()}
                      </span>
                      <span className="home-calendar-day-add-hint">
                        {t('homeCalendar.addHint', { defaultValue: '+ Add' })}
                      </span>
                    </div>
                    <div className="home-calendar-day-tasks">{renderDaySummary(dayTasks, date)}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ── Week view ── */
  const renderWeek = () => {
    const start = cursor.startOf('isoWeek');
    const days = Array.from({ length: 7 }, (_, i) => start.add(i, 'day'));
    return (
      <div className="home-calendar-week-grid">
        {days.map(date => {
          const isToday = date.isSame(dayjs(), 'day');
          const dateKey = date.format('YYYY-MM-DD');
          const dayTasks = tasksByDate.get(dateKey) || [];
          return (
            <div key={dateKey} className="home-calendar-week-col">
              <div className="home-calendar-week-col-header">
                <span className="home-calendar-weekday-label">{date.format('ddd')}</span>
                <span
                  className={`home-calendar-day-number ${isToday ? 'home-calendar-day-number-today' : ''}`}
                >
                  {date.date()}
                </span>
              </div>
              <div
                className="home-calendar-week-col-body"
                onClick={() => {
                  handleSelectDate(date);
                  openAddModal(date);
                }}
              >
                {renderDaySummary(dayTasks, date)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── Year view ── */
  const renderYear = () => {
    const months = Array.from({ length: 12 }, (_, i) => cursor.startOf('year').month(i));
    return (
      <div className="home-calendar-year-grid">
        {months.map(monthStart => {
          const isCurMonth = monthStart.isSame(dayjs(), 'month');
          const start = monthStart.startOf('month').startOf('isoWeek');
          const end = monthStart.endOf('month').endOf('isoWeek');
          const days: Dayjs[] = [];
          let d = start;
          while (d.isBefore(end) || d.isSame(end, 'day')) {
            days.push(d);
            d = d.add(1, 'day');
          }
          return (
            <div
              key={monthStart.format('YYYY-MM')}
              className="home-calendar-mini-month"
              onClick={() => {
                setCursor(monthStart);
                setCalView('month');
              }}
            >
              <div
                className={`home-calendar-mini-month-title ${isCurMonth ? 'home-calendar-mini-month-title-active' : ''}`}
              >
                {monthStart.format('MMMM YYYY')}
              </div>
              <div className="home-calendar-mini-month-weekdays">
                {MINI_WEEK_DAY_LABELS.map((label, i) => (
                  <span key={i}>{label}</span>
                ))}
              </div>
              <div className="home-calendar-mini-month-grid">
                {days.map(date => {
                  const inMonth = date.isSame(monthStart, 'month');
                  const isToday = date.isSame(dayjs(), 'day');
                  return (
                    <span
                      key={date.format('YYYY-MM-DD')}
                      className={`home-calendar-mini-day ${inMonth ? '' : 'home-calendar-mini-day-muted'} ${isToday ? 'home-calendar-mini-day-today' : ''}`}
                    >
                      {date.date()}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`home-calendar-root ${isDarkMode ? 'home-calendar-dark' : ''}`}>
      <div className="home-calendar-toolbar">
        <div className="home-calendar-view-toggle">
          {(['week', 'month', 'year'] as CalendarViewType[]).map(view => (
            <button
              key={view}
              type="button"
              className={`home-calendar-view-toggle-btn ${calView === view ? 'home-calendar-view-toggle-btn-active' : ''}`}
              onClick={() => setCalView(view)}
            >
              {view === 'week'
                ? t('homeCalendar.weekView', { defaultValue: 'Week' })
                : view === 'month'
                  ? t('homeCalendar.monthView', { defaultValue: 'Month' })
                  : t('homeCalendar.yearView', { defaultValue: 'Year' })}
            </button>
          ))}
        </div>
        <Button size="small" onClick={goToday}>
          {t('homeCalendar.todayButton', { defaultValue: 'Today' })}
        </Button>
        <Button size="small" icon={<LeftOutlined />} onClick={goPrev} />
        <Typography.Text strong className="home-calendar-title">
          {navTitle}
        </Typography.Text>
        <Button size="small" icon={<RightOutlined />} onClick={goNext} />

        <div className="home-calendar-toolbar-spacer" />

        <PillToggle<'to' | 'by'>
          value={homeTasksConfig.tasks_group_by === 1 ? 'by' : 'to'}
          onChange={handleTaskModeChange}
          options={[
            { value: 'to', label: t('tasks.assignedToMe', { defaultValue: 'Assigned to me' }) },
            { value: 'by', label: t('tasks.assignedByMe', { defaultValue: 'Assigned by me' }) },
          ]}
        />

        <MultiSelectFilterDropdown
          label={t('homeCalendar.statusesPlaceholder', { defaultValue: 'All Statuses' })}
          options={statusOptions}
          selected={filterStatuses}
          onChange={setFilterStatuses}
        />
        <MultiSelectFilterDropdown
          label={t('homeCalendar.clientsPlaceholder', { defaultValue: 'All Clients' })}
          searchPlaceholder={t('homeCalendar.clientsSearchPlaceholder', {
            defaultValue: 'Search clients...',
          })}
          options={clientOptions}
          selected={filterClients}
          onChange={setFilterClients}
          loading={clientsLoading}
        />
        <MultiSelectFilterDropdown
          label={t('homeCalendar.projectsPlaceholder', { defaultValue: 'All Projects' })}
          searchPlaceholder={t('homeCalendar.projectsSearchPlaceholder', {
            defaultValue: 'Search projects...',
          })}
          options={projectOptions}
          selected={filterProjects}
          onChange={setFilterProjects}
          loading={projectsLoading}
        />
        {anyFilterActive && (
          <Button type="link" size="small" onClick={clearFilters}>
            {t('homeCalendar.clearFilters', { defaultValue: 'Clear' })}
          </Button>
        )}
      </div>

      {calView === 'month' && renderMonth()}
      {calView === 'week' && renderWeek()}
      {calView === 'year' && renderYear()}

      <HomeAddTaskModal open={modalOpen} defaultDate={modalDate} onClose={() => setModalOpen(false)} />
    </div>
  );
};

export default HomeCalendar;
