import React, { useState, useMemo, useCallback } from 'react';
import Card from 'antd/es/card';
import Badge from 'antd/es/badge';
import Tooltip from 'antd/es/tooltip';
import { useTranslation } from 'react-i18next';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { Button, theme, PlusOutlined } from '@/shared/antd-imports';
import HomeAddTaskModal from '../task-list/HomeAddTaskModal';
import { useGetProjectsQuery, useGetMyTasksQuery } from '@/api/home-page/home-page.api.service';
import {
  useGetUserRecentTasksQuery,
  useGetUserTimeLoggedTasksQuery,
} from '@/api/home-page/user-activity.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useNavigate } from 'react-router-dom';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { IHomeTasksConfig } from '@/types/home/home-page.types';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const TASKS_TAB_CONFIG: IHomeTasksConfig = {
  current_tab: 'All',
  selected_date: null,
  tasks_group_by: 0,
  current_view: 0,
  is_calendar_view: false,
  time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
};

type ContinueTab = 'projects' | 'tasks' | 'activity' | 'time';

const ContinueEmptyState: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({
  title,
  subtitle,
  action,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: '28px 16px',
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
    {subtitle && (
      <p style={{ opacity: 0.55, fontSize: 12, margin: 0, maxWidth: 220 }}>{subtitle}</p>
    )}
    {action}
  </div>
);

const HomeContinueCard: React.FC = () => {
  const [tab, setTab] = useState<ContinueTab>('projects');
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const { t } = useTranslation('home');

  const TABS: { key: ContinueTab; label: string }[] = [
    { key: 'projects', label: t('continueCardTabs.projects', { defaultValue: 'Projects' }) },
    { key: 'tasks', label: t('continueCardTabs.tasks', { defaultValue: 'Tasks' }) },
    { key: 'activity', label: t('continueCardTabs.activity', { defaultValue: 'Activity' }) },
    { key: 'time', label: t('continueCardTabs.timeLogged', { defaultValue: 'Time Logged' }) },
  ];

  const handleOpenProject = useCallback(
    (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      navigate(`/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list`);
    },
    [navigate]
  );

  const handleOpenTask = useCallback(
    (e: React.MouseEvent, taskId: string, projectId: string) => {
      e.stopPropagation();
      dispatch(setProjectId(projectId || ''));
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTask({ taskId, projectId }));
    },
    [dispatch]
  );

  const ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    fontSize: 13,
  };

  const TAB_BTN_STYLE = (active: boolean, isLast: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    borderRight: isLast ? 'none' : `1px solid ${token.colorBorderSecondary}`,
    background: active ? '#1677ff' : 'transparent',
    color: active ? '#fff' : token.colorText,
    transition: 'all .15s',
    whiteSpace: 'nowrap' as const,
  });

  const { data: projectsData } = useGetProjectsQuery({ view: 0, limit: 12 });
  const { data: myTasksData } = useGetMyTasksQuery(TASKS_TAB_CONFIG, {
    skip: tab !== 'tasks',
  });
  const { data: recentTasksData } = useGetUserRecentTasksQuery(
    { limit: 12 },
    { skip: tab !== 'activity' }
  );
  const { data: timeData } = useGetUserTimeLoggedTasksQuery(
    { limit: 12 },
    { skip: tab !== 'time' }
  );

  const projects = useMemo(
    () => (projectsData?.body as IProjectViewModel[] | undefined) || [],
    [projectsData]
  );

  const activeTasks = useMemo(
    () => (myTasksData?.body?.tasks || []).slice(0, 12),
    [myTasksData]
  );

  const recentTasks = useMemo(() => {
    if (!recentTasksData) return [];
    if (Array.isArray(recentTasksData)) return recentTasksData.slice(0, 12);
    const body = (recentTasksData as any)?.body;
    return Array.isArray(body) ? body.slice(0, 12) : [];
  }, [recentTasksData]);

  const timeTasks = useMemo(() => {
    if (!timeData) return [];
    if (Array.isArray(timeData)) return timeData.slice(0, 12);
    const body = (timeData as any)?.body;
    return Array.isArray(body) ? body.slice(0, 12) : [];
  }, [timeData]);

  // Checking for the presence of data (rather than the query's own isLoading
  // flag) avoids a one-frame flash of the tab's "no data" placeholder: each
  // tab's query is `skip`-gated, and right after switching tabs the newly
  // unskipped query briefly reports isLoading=false (status "uninitialized")
  // before it actually starts fetching, which would otherwise let the empty
  // state render for an instant before the loader takes over.
  const isLoading =
    (tab === 'projects' && !projectsData) ||
    (tab === 'tasks' && !myTasksData) ||
    (tab === 'activity' && !recentTasksData) ||
    (tab === 'time' && !timeData);

  return (
    <Card
      style={{ borderRadius: 10, padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px 0',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('continueCardTabs.title', { defaultValue: 'Continue' })}</div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 7,
            overflow: 'hidden',
          }}
        >
          {TABS.map(({ key, label }, idx) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={TAB_BTN_STYLE(tab === key, idx === TABS.length - 1)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <WorklenzLogoLoader />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {/* Projects tab */}
          {tab === 'projects' && (
            <div>
              {projects.length === 0 ? (
                <ContinueEmptyState
                  title={t('continueCard.noRecentProjects', { defaultValue: 'No recent projects' })}
                  subtitle={t('continueCard.noRecentProjectsSubtitle', { defaultValue: 'Start or continue working on a project to see it here.' })}
                  action={
                    <Button size="small" onClick={() => navigate('/worklenz/projects')}>
                      {t('continueCard.browseProjects', { defaultValue: 'Browse Projects' })}
                    </Button>
                  }
                />
              ) : (
                projects.map(p => (
                  <div
                    key={p.id}
                    style={{ ...ROW_STYLE, cursor: 'pointer' }}
                    onClick={() => navigate(`/worklenz/projects/${p.id}?tab=tasks-list&pinned_tab=tasks-list`)}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: p.color_code || '#8c8c8c',
                        flexShrink: 0,
                      }}
                    />
                    <Tooltip title={p.name} placement="right">
                      <span
                        style={{
                          flex: 1,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.name}
                      </span>
                    </Tooltip>
                    {p.client_name && (
                      <span style={{ fontSize: 11, opacity: 0.55, flexShrink: 0 }}>
                        {p.client_name}
                      </span>
                    )}
                    {typeof p.tasks_progress === 'number' && (
                      <div
                        style={{
                          width: 60,
                          height: 4,
                          borderRadius: 2,
                          background: token.colorFillSecondary,
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: `${p.tasks_progress}%`,
                            height: '100%',
                            borderRadius: 2,
                            background: '#1677ff',
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tasks tab */}
          {tab === 'tasks' && (
            <div>
              {activeTasks.length === 0 ? (
                <ContinueEmptyState
                  title={t('continueCard.noActiveTasks', { defaultValue: 'No active tasks' })}
                  subtitle={t('continueCard.noActiveTasksSubtitle', { defaultValue: 'All your tasks are completed or not yet started.' })}
                  action={
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddTaskOpen(true)}>
                      {t('tasks.addTaskButton', { defaultValue: 'Add Task' })}
                    </Button>
                  }
                />
              ) : (
                activeTasks.map(t => (
                  <div key={t.id} style={ROW_STYLE}>
                    <Badge color={t.project_color || '#8c8c8c'} />
                    <Tooltip title={t.name} placement="right">
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                        onClick={e => handleOpenTask(e, t.id || '', t.project_id || '')}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {t.name}
                      </span>
                    </Tooltip>
                    <Tooltip title={t.project_name} placement="right">
                      <span
                        style={{
                          fontSize: 11,
                          opacity: 0.55,
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                        onClick={e => handleOpenProject(e, t.project_id || '')}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {t.project_name}
                      </span>
                    </Tooltip>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Activity tab */}
          {tab === 'activity' && (
            <div>
              {recentTasks.length === 0 ? (
                <ContinueEmptyState
                  title={t('continueCard.noRecentActivity', { defaultValue: 'No recent activity' })}
                  subtitle={t('continueCard.noRecentActivitySubtitle', { defaultValue: 'Activity on your tasks will appear here.' })}
                />
              ) : (
                recentTasks.map((t: any) => (
                  <div key={t.task_id} style={ROW_STYLE}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: t.project_color || '#8c8c8c',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Tooltip title={t.task_name} placement="right">
                        <div
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: 500,
                            cursor: 'pointer',
                            width: 'fit-content',
                            maxWidth: '100%',
                          }}
                          onClick={e => handleOpenTask(e, t.task_id, t.project_id)}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {t.task_name}
                        </div>
                      </Tooltip>
                      <Tooltip title={t.project_name} placement="right">
                        <div
                          style={{
                            fontSize: 11,
                            opacity: 0.55,
                            cursor: 'pointer',
                            width: 'fit-content',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={e => handleOpenProject(e, t.project_id)}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {t.project_name}
                        </div>
                      </Tooltip>
                    </div>
                    <span style={{ fontSize: 11, opacity: 0.4, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {t.last_activity_at ? dayjs(t.last_activity_at).fromNow() : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Time Logged tab */}
          {tab === 'time' && (
            <div>
              {timeTasks.length === 0 ? (
                <ContinueEmptyState
                  title={t('continueCard.noTimeLogged', { defaultValue: 'No time logged' })}
                  subtitle={t('continueCard.noTimeLoggedSubtitle', { defaultValue: 'Track time on tasks to see it here.' })}
                  action={
                    <Button size="small" onClick={() => navigate('/worklenz/time-entries')}>
                      {t('continueCard.viewTimeEntries', { defaultValue: 'View Time Entries' })}
                    </Button>
                  }
                />
              ) : (
                timeTasks.map((t: any) => (
                  <div key={t.task_id} style={ROW_STYLE}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: t.project_color || '#8c8c8c',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Tooltip title={t.task_name} placement="right">
                        <div
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: 500,
                            cursor: 'pointer',
                            width: 'fit-content',
                            maxWidth: '100%',
                          }}
                          onClick={e => handleOpenTask(e, t.task_id, t.project_id)}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {t.task_name}
                        </div>
                      </Tooltip>
                      <Tooltip title={t.project_name} placement="right">
                        <div
                          style={{
                            fontSize: 11,
                            opacity: 0.55,
                            cursor: 'pointer',
                            width: 'fit-content',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={e => handleOpenProject(e, t.project_id)}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {t.project_name}
                        </div>
                      </Tooltip>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1677ff', flexShrink: 0 }}>
                      {t.total_time_logged_string}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <HomeAddTaskModal
        open={addTaskOpen}
        defaultDate={null}
        onClose={() => setAddTaskOpen(false)}
      />
    </Card>
  );
};

export default HomeContinueCard;
