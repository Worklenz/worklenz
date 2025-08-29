import React, { useMemo } from 'react';
import {
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Typography,
  Progress,
  Tooltip,
  Badge,
  Space,
  theme,
  Divider,
} from '@/shared/antd-imports';
import {
  TeamOutlined,
  CheckCircleOutlined,
  ProjectOutlined,
  UserOutlined,
  SettingOutlined,
  InboxOutlined,
  MoreOutlined,
} from '@/shared/antd-imports';
import { ProjectGroupListProps } from '@/types/project/project.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { themeWiseColor } from '@/utils/themeWiseColor';
import {
  fetchProjectData,
  setProjectId,
  toggleProjectDrawer,
} from '@/features/project/project-drawer.slice';
import {
  toggleArchiveProject,
  toggleArchiveProjectForAll,
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
  groups,
  navigate,
  onProjectSelect,
  loading,
  t,
}) => {
  // Preload project view components on hover for smoother navigation
  const handleProjectHover = React.useCallback((project_id: string) => {
    if (project_id) {
      // Preload the project view route to reduce loading time
      import('@/pages/projects/projectView/project-view').catch(() => {
        // Silently fail if preload doesn't work
      });

      // Also preload critical task management components
      import('@/components/task-management/task-list-board').catch(() => {
        // Silently fail if preload doesn't work
      });
    }
  }, []);
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Theme-aware color utilities
  const getThemeAwareColor = (lightColor: string, darkColor: string) => {
    return themeWiseColor(lightColor, darkColor, themeMode);
  };

  // Enhanced color processing for better contrast
  const processColor = (color: string | undefined, fallback?: string) => {
    if (!color) return fallback || token.colorPrimary;

    if (color.startsWith('#')) {
      if (themeMode === 'dark') {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        if (brightness < 100) {
          const factor = 1.5;
          const newR = Math.min(255, Math.floor(r * factor));
          const newG = Math.min(255, Math.floor(g * factor));
          const newB = Math.min(255, Math.floor(b * factor));
          return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        }
      } else {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        if (brightness > 200) {
          const factor = 0.7;
          const newR = Math.floor(r * factor);
          const newG = Math.floor(g * factor);
          const newB = Math.floor(b * factor);
          return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        }
      }
    }

    return color;
  };

  // Action handlers
  const handleSettingsClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    console.log('Opening project drawer from project group for project:', projectId);
    trackMixpanelEvent(evt_projects_settings_click);

    // Set project ID first
    dispatch(setProjectId(projectId));

    // Then fetch project data
    dispatch(fetchProjectData(projectId))
      .unwrap()
      .then(projectData => {
        console.log('Project data fetched successfully from project group:', projectData);
        // Open drawer after data is fetched
        dispatch(toggleProjectDrawer());
      })
      .catch(error => {
        console.error('Failed to fetch project data from project group:', error);
        // Still open drawer even if fetch fails, so user can see error state
        dispatch(toggleProjectDrawer());
      });
  };

  const handleArchiveClick = async (
    e: React.MouseEvent,
    projectId: string,
    isArchived: boolean
  ) => {
    e.stopPropagation();
    try {
      if (isOwnerOrAdmin) {
        trackMixpanelEvent(evt_projects_archive_all);
        await dispatch(toggleArchiveProjectForAll(projectId));
      } else {
        trackMixpanelEvent(evt_projects_archive);
        await dispatch(toggleArchiveProject(projectId));
      }
    } catch (error) {
      logger.error('Failed to archive project:', error);
    }
  };

  // Memoized styles for better performance
  const styles = useMemo(
    () => ({
      container: {
        padding: '0',
        background: 'transparent',
      },
      groupSection: {
        marginBottom: '24px',
        background: 'transparent',
      },
      groupHeader: {
        background: getThemeAwareColor(
          `linear-gradient(135deg, ${token.colorFillAlter} 0%, ${token.colorFillTertiary} 100%)`,
          `linear-gradient(135deg, ${token.colorFillQuaternary} 0%, ${token.colorFillSecondary} 100%)`
        ),
        borderRadius: token.borderRadius,
        padding: '12px 16px',
        marginBottom: '12px',
        border: `1px solid ${getThemeAwareColor(token.colorBorderSecondary, token.colorBorder)}`,
        boxShadow: getThemeAwareColor(
          '0 1px 4px rgba(0, 0, 0, 0.06)',
          '0 1px 4px rgba(0, 0, 0, 0.15)'
        ),
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      groupTitle: {
        margin: 0,
        color: getThemeAwareColor(token.colorText, token.colorTextBase),
        fontSize: '16px',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      },
      groupMeta: {
        color: getThemeAwareColor(token.colorTextSecondary, token.colorTextTertiary),
        fontSize: '12px',
        marginTop: '2px',
      },
      projectCard: {
        height: '100%',
        borderRadius: token.borderRadius,
        border: `1px solid ${getThemeAwareColor(token.colorBorderSecondary, token.colorBorder)}`,
        boxShadow: getThemeAwareColor(
          '0 1px 4px rgba(0, 0, 0, 0.04)',
          '0 1px 4px rgba(0, 0, 0, 0.12)'
        ),
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        overflow: 'hidden',
        background: getThemeAwareColor(token.colorBgContainer, token.colorBgElevated),
      },
      projectCardHover: {
        transform: 'translateY(-2px)',
        boxShadow: getThemeAwareColor(
          '0 4px 12px rgba(0, 0, 0, 0.08)',
          '0 4px 12px rgba(0, 0, 0, 0.20)'
        ),
        borderColor: getThemeAwareColor(token.colorPrimary, token.colorPrimaryActive),
      },
      statusBar: {
        height: '3px',
        background: 'linear-gradient(90deg, transparent 0%, currentColor 100%)',
        borderRadius: '0 0 2px 2px',
      },
      projectContent: {
        padding: '12px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column' as const,
        minHeight: '200px', // Ensure minimum height for consistent card sizes
      },
      projectTitle: {
        margin: '0 0 6px 0',
        color: getThemeAwareColor(token.colorText, token.colorTextBase),
        fontSize: '14px',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      clientName: {
        color: getThemeAwareColor(token.colorTextSecondary, token.colorTextTertiary),
        fontSize: '12px',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      },
      progressSection: {
        marginBottom: '10px',
        // Remove flex: 1 to prevent it from taking all available space
      },
      progressLabel: {
        fontSize: '10px',
        color: getThemeAwareColor(token.colorTextTertiary, token.colorTextQuaternary),
        marginBottom: '4px',
        fontWeight: 500,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.3px',
      },
      metaGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        marginTop: 'auto', // This pushes the meta section to the bottom
        paddingTop: '10px',
        borderTop: `1px solid ${getThemeAwareColor(token.colorBorderSecondary, token.colorBorder)}`,
        flexShrink: 0, // Prevent the meta section from shrinking
      },
      metaItem: {
        display: 'flex',
        flexDirection: 'row' as const,
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: token.borderRadiusSM,
        background: getThemeAwareColor(token.colorFillAlter, token.colorFillQuaternary),
        transition: 'all 0.2s ease',
      },
      metaContent: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1px',
        flex: 1,
      },
      metaIcon: {
        fontSize: '12px',
        color: getThemeAwareColor(token.colorPrimary, token.colorPrimaryActive),
      },
      metaValue: {
        fontSize: '11px',
        fontWeight: 600,
        color: getThemeAwareColor(token.colorText, token.colorTextBase),
        lineHeight: 1,
      },
      metaLabel: {
        fontSize: '9px',
        color: getThemeAwareColor(token.colorTextTertiary, token.colorTextQuaternary),
        lineHeight: 1,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.2px',
      },
      actionButtons: {
        position: 'absolute' as const,
        top: '8px',
        right: '8px',
        display: 'flex',
        gap: '4px',
        opacity: 0,
        transition: 'opacity 0.2s ease',
      },
      actionButton: {
        width: '24px',
        height: '24px',
        borderRadius: '4px',
        border: 'none',
        background: getThemeAwareColor('rgba(255,255,255,0.9)', 'rgba(0,0,0,0.7)'),
        color: getThemeAwareColor(token.colorTextSecondary, token.colorTextTertiary),
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(4px)',
        '&:hover': {
          background: getThemeAwareColor(token.colorPrimary, token.colorPrimaryActive),
          color: getThemeAwareColor('#fff', token.colorTextLightSolid),
          transform: 'scale(1.1)',
        },
      },
      emptyState: {
        padding: '60px 20px',
        textAlign: 'center' as const,
        background: getThemeAwareColor(token.colorFillAlter, token.colorFillQuaternary),
        borderRadius: token.borderRadiusLG,
        border: `2px dashed ${getThemeAwareColor(token.colorBorderSecondary, token.colorBorder)}`,
      },
      loadingContainer: {
        padding: '40px 20px',
      },
    }),
    [token, themeMode, getThemeAwareColor]
  );

  // Early return for loading state
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  // Early return for empty state
  if (groups.length === 0) {
    return (
      <div style={styles.emptyState}>
        <Empty
          image={<ProjectOutlined style={{ fontSize: '48px', color: token.colorTextTertiary }} />}
          description={
            <div>
              <Text style={{ fontSize: '16px', color: token.colorTextSecondary }}>
                {t('noProjects')}
              </Text>
              <br />
              <Text style={{ fontSize: '14px', color: token.colorTextTertiary }}>
                Create your first project to get started
              </Text>
            </div>
          }
        />
      </div>
    );
  }

  const renderProjectCard = (project: any) => {
    const projectColor = processColor(project.color_code, token.colorPrimary);
    const statusColor = processColor(project.status_color, token.colorPrimary);
    const progress = project.progress || 0;
    const completedTasks = project.completed_tasks_count || 0;
    const totalTasks = project.all_tasks_count || 0;
    const membersCount = project.members_count || 0;

    return (
      <Col key={project.id} xs={24} sm={12} md={8} lg={6} xl={4}>
        <Card
          style={{ ...styles.projectCard, position: 'relative' }}
          onMouseEnter={e => {
            Object.assign(e.currentTarget.style, styles.projectCardHover);
            const actionButtons = e.currentTarget.querySelector('.action-buttons') as HTMLElement;
            if (actionButtons) {
              actionButtons.style.opacity = '1';
            }
            // Preload components for smoother navigation
            handleProjectHover(project.id);
          }}
          onMouseLeave={e => {
            Object.assign(e.currentTarget.style, styles.projectCard);
            const actionButtons = e.currentTarget.querySelector('.action-buttons') as HTMLElement;
            if (actionButtons) {
              actionButtons.style.opacity = '0';
            }
          }}
          onClick={() => onProjectSelect(project.id || '')}
          bodyStyle={{ padding: 0 }}
        >
          {/* Action buttons */}
          <div className="action-buttons" style={styles.actionButtons}>
            <Tooltip title={t('setting')}>
              <button
                style={styles.actionButton}
                onClick={e => handleSettingsClick(e, project.id)}
                onMouseEnter={e => {
                  Object.assign(e.currentTarget.style, {
                    background: getThemeAwareColor(token.colorPrimary, token.colorPrimaryActive),
                    color: getThemeAwareColor('#fff', token.colorTextLightSolid),
                    transform: 'scale(1.1)',
                  });
                }}
                onMouseLeave={e => {
                  Object.assign(e.currentTarget.style, {
                    background: getThemeAwareColor('rgba(255,255,255,0.9)', 'rgba(0,0,0,0.7)'),
                    color: getThemeAwareColor(token.colorTextSecondary, token.colorTextTertiary),
                    transform: 'scale(1)',
                  });
                }}
              >
                <SettingOutlined />
              </button>
            </Tooltip>
            <Tooltip title={project.archived ? t('unarchive') : t('archive')}>
              <button
                style={styles.actionButton}
                onClick={e => handleArchiveClick(e, project.id, project.archived)}
                onMouseEnter={e => {
                  Object.assign(e.currentTarget.style, {
                    background: getThemeAwareColor(token.colorPrimary, token.colorPrimaryActive),
                    color: getThemeAwareColor('#fff', token.colorTextLightSolid),
                    transform: 'scale(1.1)',
                  });
                }}
                onMouseLeave={e => {
                  Object.assign(e.currentTarget.style, {
                    background: getThemeAwareColor('rgba(255,255,255,0.9)', 'rgba(0,0,0,0.7)'),
                    color: getThemeAwareColor(token.colorTextSecondary, token.colorTextTertiary),
                    transform: 'scale(1)',
                  });
                }}
              >
                <InboxOutlined />
              </button>
            </Tooltip>
          </div>
          {/* Project color indicator bar */}
          <div
            style={{
              ...styles.statusBar,
              color: projectColor,
            }}
          />

          <div style={styles.projectContent}>
            {/* Project title */}
            <Title
              level={5}
              ellipsis={{ rows: 2, tooltip: project.name }}
              style={styles.projectTitle}
            >
              {project.name}
            </Title>

            {/* Client name */}
            {project.client_name && (
              <div style={styles.clientName}>
                <UserOutlined />
                <Text ellipsis style={{ color: 'inherit' }}>
                  {project.client_name}
                </Text>
              </div>
            )}

            {/* Progress section */}
            <div style={styles.progressSection}>
              <div style={styles.progressLabel}>Progress</div>
              <Progress
                percent={progress}
                size="small"
                strokeColor={{
                  '0%': projectColor,
                  '100%': statusColor,
                }}
                trailColor={getThemeAwareColor(token.colorFillSecondary, token.colorFillTertiary)}
                strokeWidth={4}
                showInfo={false}
              />
              <Text
                style={{
                  fontSize: '10px',
                  color: getThemeAwareColor(token.colorTextSecondary, token.colorTextTertiary),
                  marginTop: '2px',
                  display: 'block',
                }}
              >
                {progress}%
              </Text>
            </div>

            {/* Meta information grid */}
            <div style={styles.metaGrid}>
              <Tooltip title="Tasks completed">
                <div style={styles.metaItem}>
                  <CheckCircleOutlined style={styles.metaIcon} />
                  <div style={styles.metaContent}>
                    <span style={styles.metaValue}>
                      {completedTasks}/{totalTasks}
                    </span>
                    <span style={styles.metaLabel}>Tasks</span>
                  </div>
                </div>
              </Tooltip>

              <Tooltip title="Team members">
                <div style={styles.metaItem}>
                  <TeamOutlined style={styles.metaIcon} />
                  <div style={styles.metaContent}>
                    <span style={styles.metaValue}>{membersCount}</span>
                    <span style={styles.metaLabel}>Members</span>
                  </div>
                </div>
              </Tooltip>
            </div>
          </div>
        </Card>
      </Col>
    );
  };

  return (
    <div style={styles.container}>
      {groups.map((group, groupIndex) => (
        <div key={group.groupKey} style={styles.groupSection}>
          {/* Enhanced group header */}
          <div style={styles.groupHeader}>
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space align="center">
                {group.groupColor && (
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: processColor(group.groupColor),
                      flexShrink: 0,
                      border: `2px solid ${getThemeAwareColor('rgba(255,255,255,0.8)', 'rgba(0,0,0,0.3)')}`,
                    }}
                  />
                )}
                <div>
                  <Title level={4} style={styles.groupTitle}>
                    {group.groupName}
                  </Title>
                  <div style={styles.groupMeta}>
                    {group.projects.length} {group.projects.length === 1 ? 'project' : 'projects'}
                  </div>
                </div>
              </Space>

              <Badge
                count={group.projects.length}
                style={{
                  backgroundColor: processColor(group.groupColor, token.colorPrimary),
                  color: getThemeAwareColor('#fff', token.colorTextLightSolid),
                  fontWeight: 600,
                  fontSize: '12px',
                  minWidth: '24px',
                  height: '24px',
                  lineHeight: '22px',
                  borderRadius: '12px',
                  border: `2px solid ${getThemeAwareColor(token.colorBgContainer, token.colorBgElevated)}`,
                }}
              />
            </Space>
          </div>

          {/* Projects grid */}
          <Row gutter={[16, 16]}>{group.projects.map(renderProjectCard)}</Row>

          {/* Add spacing between groups except for the last one */}
          {groupIndex < groups.length - 1 && (
            <Divider
              style={{
                margin: '32px 0 0 0',
                borderColor: getThemeAwareColor(token.colorBorderSecondary, token.colorBorder),
                opacity: 0.5,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default ProjectGroupList;
