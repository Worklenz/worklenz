import React, { useMemo } from 'react';
import {
  Table,
  Empty,
  Skeleton,
  Typography,
  Tooltip,
  Badge,
  Space,
  theme,
  Divider,
  Popconfirm,
  Progress,
  Tag,
} from '@/shared/antd-imports';

import {
  ProjectOutlined,
  SettingOutlined,
  InboxOutlined,
} from '@/shared/antd-imports';

import { ProjectGroupListProps } from '@/types/project/project.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { themeWiseColor } from '@/utils/themeWiseColor';

import {
  fetchProjectData,
  setProjectId,
  setProjectData,
  toggleProjectDrawer,
} from '@/features/project/project-drawer.slice';

import {
  toggleArchiveProject,
  toggleArchiveProjectForAll,
  fetchGroupedProjects,
} from '@/features/projects/projectsSlice';

import { useAuthService } from '@/hooks/useAuth';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';

import {
  evt_projects_settings_click,
  evt_projects_archive,
  evt_projects_archive_all,
} from '@/shared/worklenz-analytics-events';

import logger from '@/utils/errorLogger';
import { ProjectRateCell } from '@/components/project-list/project-list-table/project-list-favorite/project-rate-cell';
import { ProjectListUpdatedAt } from '@/components/project-list/project-list-table/project-list-updated-at/project-list-updated';

const { Title, Text } = Typography;

const ProjectGroupList: React.FC<ProjectGroupListProps> = ({
  groups = [],
  navigate,
  onProjectSelect,
  loading,
  t,
}) => {
  const { groupedRequestParams } = useAppSelector(state => state.projectsReducer);
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const getThemeAwareColor = (lightColor: string, darkColor: string) =>
    themeWiseColor(lightColor, darkColor, themeMode);

  const processColor = (color: string | undefined, fallback?: string) =>
    color || fallback || token.colorPrimary;

  const handleProjectHover = React.useCallback((project_id: string) => {
    if (project_id) {
      import('@/pages/projects/projectView/project-view').catch(() => {});
      import('@/components/task-management/task-list-board').catch(() => {});
    }
  }, []);

  const handleSettingsClick = (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    if (!project?.id) return;
    trackMixpanelEvent(evt_projects_settings_click);
    dispatch(setProjectId(project.id));
    dispatch(fetchProjectData(project.id))
      .unwrap()
      .then(projectData => {
        dispatch(
          setProjectData({
            ...projectData,
            priority_id: projectData.priority_id || project.priority_id,
            priority_name: projectData.priority_name || project.priority_name,
            priority_color: projectData.priority_color || project.priority_color,
            priority_color_dark: projectData.priority_color_dark || project.priority_color_dark,
          })
        );
        dispatch(toggleProjectDrawer());
      })
      .catch(() => {
        dispatch(setProjectData(project));
        dispatch(toggleProjectDrawer());
      });
  };

  const handleArchiveClick = async (projectId: string) => {
    try {
      if (isOwnerOrAdmin) {
        trackMixpanelEvent(evt_projects_archive_all);
        await dispatch(toggleArchiveProjectForAll(projectId)).unwrap();
      } else {
        trackMixpanelEvent(evt_projects_archive);
        await dispatch(toggleArchiveProject(projectId)).unwrap();
      }
      await dispatch(fetchGroupedProjects(groupedRequestParams)).unwrap();
    } catch (error) {
      logger.error('Failed to archive project:', error);
    }
  };

  // ✅ Column order: Favorite → Name → Client → Priority → Status → Tasks Progress → Category → Last Updated → Actions
  const tableColumns = useMemo(
    () => [
      // 1. Favorite
      {
        title: '',
        key: 'favorite',
        width: 50,
        render: (_: any, record: any) => (
          <ProjectRateCell key={record.id} t={t} record={record} />
        ),
      },
      // 2. Name
      {
        title: t('name', { defaultValue: 'Name' }),
        dataIndex: 'name',
        key: 'name',
        render: (text: string, record: any) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: record.color_code || token.colorPrimary,
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            <Tooltip title={text}>
              <span style={{ fontWeight: 500, cursor: 'pointer' }}>{text}</span>
            </Tooltip>
          </div>
        ),
      },
      // 3. Client
      {
        title: t('client', { defaultValue: 'Client' }),
        dataIndex: 'client_name',
        key: 'client_name',
        render: (text: string) => text || '—',
      },
      // 4. Priority
      {
        title: t('priority', { defaultValue: 'Priority' }),
        dataIndex: 'priority_name',
        key: 'priority_name',
        render: (_: any, record: any) => {
          if (!record.priority_name) {
            return <span style={{ color: 'var(--ant-color-text-quaternary)' }}>—</span>;
          }
          const color =
            themeMode === 'dark' ? record.priority_color_dark : record.priority_color;
          return (
            <span style={{ color: color || undefined, fontWeight: 500, fontSize: 13 }}>
              {record.priority_name}
            </span>
          );
        },
      },
      // 5. Status
      {
        title: t('status', { defaultValue: 'Status' }),
        dataIndex: 'status',
        key: 'status',
        render: (text: string) => text || '—',
      },
      // 6. Tasks Progress
      {
        title: t('tasksProgress', { defaultValue: 'Tasks Progress' }),
        key: 'tasksProgress',
        render: (_: any, record: any) => {
          const completed = record?.completed_tasks_count || 0;
          const total = record?.all_tasks_count || 0;
          const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
          return (
            <Tooltip title={`${completed} / ${total} tasks completed.`}>
              <Progress percent={percent} size="small" />
            </Tooltip>
          );
        },
      },
      // 7. Category
      {
        title: t('category', { defaultValue: 'Category' }),
        dataIndex: 'category_name',
        key: 'category_name',
        render: (text: string, record: any) => {
          if (!text || text === '-') return <>-</>;
          return (
            <Tag color={record.category_color || '#ff9c3c'} style={{ borderRadius: '50rem' }}>
              {text}
            </Tag>
          );
        },
      },
      // 8. Last Updated
      {
        title: t('updated_at', { defaultValue: 'Last Updated' }),
        dataIndex: 'updated_at',
        key: 'updated_at',
        width: 160,
        render: (_: any, record: any) => <ProjectListUpdatedAt record={record} />,
      },
      // 9. Actions
      {
        title: '',
        key: 'actions',
        width: 80,
        render: (_: any, record: any) => (
          <Space size="small" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <Tooltip title={t('setting', { defaultValue: 'Settings' })}>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                onClick={e => handleSettingsClick(e, record)}
              >
                <SettingOutlined />
              </button>
            </Tooltip>
            <Popconfirm
              title={record.archived ? t('unarchive') : t('archive')}
              description={record.archived ? t('unarchiveConfirm') : t('archiveConfirm')}
              onConfirm={() => handleArchiveClick(record.id)}
              okText={t('yes')}
              cancelText={t('no')}
              disabled={!isOwnerOrAdmin}
            >
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: isOwnerOrAdmin ? 'pointer' : 'not-allowed',
                  opacity: isOwnerOrAdmin ? 1 : 0.5,
                  padding: '2px 6px',
                }}
                onClick={e => e.stopPropagation()}
                disabled={!isOwnerOrAdmin}
              >
                <InboxOutlined />
              </button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [token, t, themeMode, isOwnerOrAdmin]
  );

  if (loading) {
    return (
      <div style={{ padding: '40px 20px' }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div
        style={{
          padding: '60px 20px',
          textAlign: 'center',
          background: getThemeAwareColor(token.colorFillAlter, token.colorFillQuaternary),
          borderRadius: token.borderRadiusLG,
          border: `2px dashed ${token.colorBorderSecondary}`,
        }}
      >
        <Empty
          image={<ProjectOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />}
          description={<Text>{t('noProjects')}</Text>}
        />
      </div>
    );
  }

  return (
    <div>
      {groups.map((group, groupIndex) => {
        const projects = group?.projects || [];

        return (
          <div key={group?.groupKey || groupIndex} style={{ marginBottom: 24 }}>
            {/* Group header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                marginBottom: 8,
                borderRadius: token.borderRadius,
                background: getThemeAwareColor(token.colorFillAlter, token.colorFillSecondary),
                border: `1px solid ${token.colorBorder}`,
              }}
            >
              <Space align="center">
                {group?.groupColor && (
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      backgroundColor: processColor(group.groupColor),
                      flexShrink: 0,
                    }}
                  />
                )}
                <div>
                  <Title level={5} style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    {group?.groupName || 'Unnamed Group'}
                  </Title>
                  <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                    {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                  </Text>
                </div>
              </Space>
              <Badge
                count={projects.length}
                style={{
                  backgroundColor: processColor(group.groupColor, token.colorPrimary),
                  fontWeight: 600,
                  fontSize: 11,
                }}
              />
            </div>

            <Table
              columns={tableColumns}
              dataSource={projects.map((p: any) => ({ ...p, key: p?.id }))}
              rowKey="id"
              pagination={false}
              size="small"
              onRow={record => ({
                onClick: () =>
                  onProjectSelect(
                    record?.id || '',
                    (record as any)?.team_member_default_view || (record as any)?.default_view
                  ),
                style: { cursor: 'pointer' },
                onMouseEnter: () => handleProjectHover(record?.id || ''),
              })}
            />

            {groupIndex < groups.length - 1 && (
              <Divider style={{ margin: '24px 0 0 0', opacity: 0.4 }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProjectGroupList;