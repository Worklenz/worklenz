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
} from '@/shared/antd-imports';

import {
  TeamOutlined,
  CheckCircleOutlined,
  ProjectOutlined,
  SettingOutlined,
  InboxOutlined,
  StarFilled,
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

const { Title, Text } = Typography;

const ProjectGroupList: React.FC<ProjectGroupListProps> = ({
  groups = [],
  navigate,
  onProjectSelect,
  loading,
  t,
}) => {
  const { groupedRequestParams } = useAppSelector(
    state => state.projectsReducer
  );

  const { token } = theme.useToken();

  const themeMode = useAppSelector(
    state => state.themeReducer.mode
  );

  const dispatch = useAppDispatch();

  const isOwnerOrAdmin =
    useAuthService().isOwnerOrAdmin();

  const { trackMixpanelEvent } =
    useMixpanelTracking();

  // -----------------------------
  // Helpers
  // -----------------------------

  const getThemeAwareColor = (
    lightColor: string,
    darkColor: string
  ) => {
    return themeWiseColor(
      lightColor,
      darkColor,
      themeMode
    );
  };

  const processColor = (
    color: string | undefined,
    fallback?: string
  ) => {
    if (!color) return fallback || token.colorPrimary;

    return color;
  };

  // -----------------------------
  // Hover preload
  // -----------------------------

  const handleProjectHover = React.useCallback(
    (project_id: string) => {
      if (project_id) {
        import(
          '@/pages/projects/projectView/project-view'
        ).catch(() => {});

        import(
          '@/components/task-management/task-list-board'
        ).catch(() => {});
      }
    },
    []
  );

  // -----------------------------
  // Actions
  // -----------------------------

  const handleSettingsClick = (
    e: React.MouseEvent,
    project: any
  ) => {
    e.stopPropagation();

    if (!project?.id) return;

    trackMixpanelEvent(
      evt_projects_settings_click
    );

    dispatch(setProjectId(project.id));

    dispatch(fetchProjectData(project.id))
      .unwrap()
      .then(projectData => {
        dispatch(
          setProjectData({
            ...projectData,
            priority_id:
              projectData.priority_id ||
              project.priority_id,

            priority_name:
              projectData.priority_name ||
              project.priority_name,

            priority_color:
              projectData.priority_color ||
              project.priority_color,

            priority_color_dark:
              projectData.priority_color_dark ||
              project.priority_color_dark,
          })
        );

        dispatch(toggleProjectDrawer());
      })
      .catch(error => {
        console.error(error);

        dispatch(setProjectData(project));

        dispatch(toggleProjectDrawer());
      });
  };

  const handleArchiveClick = async (
    projectId: string
  ) => {
    try {
      if (isOwnerOrAdmin) {
        trackMixpanelEvent(
          evt_projects_archive_all
        );

        await dispatch(
          toggleArchiveProjectForAll(projectId)
        ).unwrap();
      } else {
        trackMixpanelEvent(evt_projects_archive);

        await dispatch(
          toggleArchiveProject(projectId)
        ).unwrap();
      }

      await dispatch(
        fetchGroupedProjects(groupedRequestParams)
      ).unwrap();
    } catch (error) {
      logger.error(
        'Failed to archive project:',
        error
      );
    }
  };

  // -----------------------------
  // Styles
  // -----------------------------

  const styles = useMemo(
    () => ({
      container: {
        padding: '0',
        background: 'transparent',
      },

      groupSection: {
        marginBottom: '24px',
      },

      groupHeader: {
        background: getThemeAwareColor(
          token.colorFillAlter,
          token.colorFillSecondary
        ),

        borderRadius: token.borderRadius,

        padding: '12px 16px',

        marginBottom: '12px',

        border: `1px solid ${token.colorBorder}`,
      },

      groupTitle: {
        margin: 0,

        color: token.colorText,

        fontSize: '16px',

        fontWeight: 600,
      },

      groupMeta: {
        color: token.colorTextSecondary,

        fontSize: '12px',
      },

      emptyState: {
        padding: '60px 20px',

        textAlign: 'center' as const,
      },

      loadingContainer: {
        padding: '40px 20px',
      },
    }),
    [token, themeMode]
  );

  // -----------------------------
  // IMPORTANT:
  // Hooks MUST stay above returns
  // -----------------------------

  const tableColumns = useMemo(
    () => [
      {
        title: '',
        key: 'favorite',
        width: 50,

        render: () => (
          <StarFilled
            style={{
              color: token.colorTextTertiary,
            }}
          />
        ),
      },

      {
        title: t('name', {
          defaultValue: 'Name',
        }),

        dataIndex: 'name',

        key: 'name',

        render: (text: string) => (
          <Tooltip title={text}>
            <span
              style={{
                fontWeight: 500,
              }}
            >
              {text}
            </span>
          </Tooltip>
        ),
      },

      {
        title: t('client', {
          defaultValue: 'Client',
        }),

        dataIndex: 'client_name',

        key: 'client_name',

        render: (text: string) => text || '—',
      },

      {
        title: t('status', {
          defaultValue: 'Status',
        }),

        dataIndex: 'status',

        key: 'status',

        render: (text: string) => text || '—',
      },

      {
        title: t('tasks', {
          defaultValue: 'Tasks',
        }),

        key: 'tasks',

        render: (_: any, record: any) => {
          const completed =
            record?.completed_tasks_count || 0;

          const total =
            record?.all_tasks_count || 0;

          return (
            <span>
              <CheckCircleOutlined
                style={{
                  marginRight: 4,
                }}
              />

              {completed}/{total}
            </span>
          );
        },
      },

      {
        title: t('members', {
          defaultValue: 'Members',
        }),

        key: 'members',

        render: (_: any, record: any) => {
          const count =
            record?.members_count || 0;

          return (
            <span>
              <TeamOutlined
                style={{
                  marginRight: 4,
                }}
              />

              {count}
            </span>
          );
        },
      },

      {
        title: '',

        key: 'actions',

        width: 100,

        render: (_: any, record: any) => (
          <Space size="small">
            <Tooltip
              title={t('setting', {
                defaultValue: 'Settings',
              })}
            >
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={e =>
                  handleSettingsClick(e, record)
                }
              >
                <SettingOutlined />
              </button>
            </Tooltip>

            <Popconfirm
              title={t('archive', {
                defaultValue: 'Archive',
              })}
              onConfirm={e => {
                e?.stopPropagation();

                handleArchiveClick(record.id);
              }}
            >
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: isOwnerOrAdmin
                    ? 'pointer'
                    : 'not-allowed',

                  opacity: isOwnerOrAdmin
                    ? 1
                    : 0.5,
                }}
                onClick={e =>
                  e.stopPropagation()
                }
                disabled={!isOwnerOrAdmin}
              >
                <InboxOutlined />
              </button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [token, t, isOwnerOrAdmin]
  );

  // -----------------------------
  // Loading
  // -----------------------------

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Skeleton
          active
          paragraph={{ rows: 6 }}
        />
      </div>
    );
  }

  // -----------------------------
  // Empty state
  // -----------------------------

  if (!groups || groups.length === 0) {
    return (
      <div style={styles.emptyState}>
        <Empty
          image={
            <ProjectOutlined
              style={{
                fontSize: 48,
                color:
                  token.colorTextTertiary,
              }}
            />
          }
          description={
            <div>
              <Text>
                {t('noProjects')}
              </Text>
            </div>
          }
        />
      </div>
    );
  }

  // -----------------------------
  // Main render
  // -----------------------------

  return (
    <div style={styles.container}>
      {(groups || []).map(
        (group, groupIndex) => {
          const projects =
            group?.projects || [];

          return (
            <div
              key={
                group?.groupKey ||
                groupIndex
              }
              style={styles.groupSection}
            >
              {/* Header */}

              <div style={styles.groupHeader}>
                <Space
                  align="center"
                  style={{
                    width: '100%',
                    justifyContent:
                      'space-between',
                  }}
                >
                  <Space align="center">
                    {group?.groupColor && (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor:
                            processColor(
                              group.groupColor
                            ),
                        }}
                      />
                    )}

                    <div>
                      <Title
                        level={4}
                        style={
                          styles.groupTitle
                        }
                      >
                        {group?.groupName ||
                          'Unnamed Group'}
                      </Title>

                      <div
                        style={
                          styles.groupMeta
                        }
                      >
                        {projects.length}{' '}
                        {projects.length === 1
                          ? 'project'
                          : 'projects'}
                      </div>
                    </div>
                  </Space>

                  <Badge
                    count={projects.length}
                  />
                </Space>
              </div>

              {/* Table */}

              <Table
                columns={tableColumns}
                dataSource={projects.map(
                  (p: any) => ({
                    ...p,
                    key: p?.id,
                  })
                )}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 1200 }}
                onRow={record => ({
                  onClick: () =>
                    onProjectSelect(
                      record?.id || '',
                      record?.team_member_default_view ||
                        record?.default_view
                    ),

                  style: {
                    cursor: 'pointer',
                  },

                  onMouseEnter: () =>
                    handleProjectHover(
                      record?.id
                    ),
                })}
              />

              {groupIndex <
                groups.length - 1 && (
                <Divider
                  style={{
                    margin:
                      '32px 0 0 0',
                  }}
                />
              )}
            </div>
          );
        }
      )}
    </div>
  );
};

export default ProjectGroupList;