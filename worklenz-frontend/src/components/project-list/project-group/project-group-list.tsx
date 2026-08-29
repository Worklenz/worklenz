import React, { useMemo, useState, useCallback } from 'react';
import {
  Table,
  Empty,
  Skeleton,
  Typography,
  Tooltip,
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
  DownOutlined,
  RightOutlined,
} from '@/shared/antd-imports';

import { ProjectGroupListProps } from '@/types/project/project.types';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { getContrastColor } from '@/utils/colorUtils';

import {
  fetchProjectData,
  setProjectId,
  setProjectData,
} from '@/features/project/project-drawer.slice';
import { openProjectSettingsModal } from '@/features/project/project-settings-modal.slice';

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
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import { ProjectRateCell } from '@/components/project-list/project-list-table/project-list-favorite/project-rate-cell';
import { ProjectListUpdatedAt } from '@/components/project-list/project-list-table/project-list-updated-at/project-list-updated';

const { Title, Text } = Typography;

// ── Presence-aware comparators for Client / Category columns.
//
// Requirement: projects that HAVE a client/category must always appear
// above projects that don't — in BOTH ascending and descending order.
// Only the alphabetical ordering *within* the "has a value" group (and
// within the "no value" group) should flip with direction.
//
// AntD's default column `sorter` return value gets auto-negated whenever
// the user switches to descending, so a plain comparator function can
// never keep the "has value" group pinned in place across both directions
// — the presence check would flip right along with the alphabetical part.
// To avoid that, these columns use `sorter: true` (no auto comparator) and
// we sort the data ourselves in `getSortedProjects` based on tracked sort
// state, applying direction only to the alphabetical part.
const compareClientPresenceTop = (
  a: IProjectViewModel,
  b: IProjectViewModel,
  order?: 'ascend' | 'descend'
): number => {
  const aVal = a.client_name?.trim();
  const bVal = b.client_name?.trim();
  const aHas = !!aVal;
  const bHas = !!bVal;

  // Presence always wins, regardless of direction.
  if (aHas !== bHas) return aHas ? -1 : 1;
  // Neither has a client -> equal
  if (!aHas && !bHas) return 0;

  const cmp = aVal!.localeCompare(bVal!);
  return order === 'descend' ? -cmp : cmp;
};

const compareCategoryPresenceTop = (
  a: IProjectViewModel,
  b: IProjectViewModel,
  order?: 'ascend' | 'descend'
): number => {
  const aVal = a.category_name?.trim();
  const bVal = b.category_name?.trim();
  const aHas = !!aVal;
  const bHas = !!bVal;

  // Presence always wins, regardless of direction.
  if (aHas !== bHas) return aHas ? -1 : 1;
  // Neither has a category -> equal
  if (!aHas && !bHas) return 0;

  const cmp = aVal!.localeCompare(bVal!);
  return order === 'descend' ? -cmp : cmp;
};

const ProjectGroupList: React.FC<ProjectGroupListProps> = ({
  groups = [],
  navigate,
  onProjectSelect,
  loading,
  t,
}) => {
  const { groupedRequestParams } = useAppSelector(state => state.projectsReducer);
  const projectListFields = useAppSelector(state => state.projectListFieldsReducer.fields);
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Track which groups are collapsed. Default: only the first group expanded.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const hasInitialized = React.useRef(false);

  // Manual sort state per group table, used only for the CLIENT and
  // CATEGORY columns (see compareClientPresenceTop / compareCategoryPresenceTop
  // above for why these two need controlled sorting instead of AntD's default).
  const [sortStates, setSortStates] = useState<
    Record<string, { columnKey?: string; order?: 'ascend' | 'descend' }>
  >({});

  const handleSortChange = useCallback((groupKey: string, sorterResult: any) => {
    setSortStates(prev => ({
      ...prev,
      [groupKey]: {
        columnKey: sorterResult?.columnKey as string | undefined,
        order: sorterResult?.order as 'ascend' | 'descend' | undefined,
      },
    }));
  }, []);

  // Applies manual sorting only when the active sorted column is CLIENT or
  // CATEGORY. For every other column, AntD's own internal sorter (the
  // `sorter` function defined on that column) already handles it correctly,
  // so we just return the projects untouched and let the Table component sort.
  const getSortedProjects = useCallback(
    (
      projects: IProjectViewModel[],
      sortInfo?: { columnKey?: string; order?: 'ascend' | 'descend' }
    ) => {
      if (!sortInfo?.order || !sortInfo.columnKey) return projects;

      if (sortInfo.columnKey === 'CLIENT') {
        return [...projects].sort((a, b) => compareClientPresenceTop(a, b, sortInfo.order));
      }
      if (sortInfo.columnKey === 'CATEGORY') {
        return [...projects].sort((a, b) => compareCategoryPresenceTop(a, b, sortInfo.order));
      }
      return projects;
    },
    []
  );

  React.useEffect(() => {
    if (!hasInitialized.current && groups.length > 0) {
      hasInitialized.current = true;
      const collapsedByDefault = groups
        .map((g, i) => g?.groupKey || String(i))
        .filter((_, i) => i !== 0);
      setCollapsedGroups(new Set(collapsedByDefault));
    }
  }, [groups]);

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const allKeys = useMemo(
    () => groups.map((g, i) => g?.groupKey || String(i)),
    [groups]
  );

  const allCollapsed = collapsedGroups.size === allKeys.length;

  const handleCollapseAll = useCallback(() => {
    setCollapsedGroups(new Set(allKeys));
  }, [allKeys]);

  const handleExpandAll = useCallback(() => {
    setCollapsedGroups(new Set());
  }, []);

  const getThemeAwareColor = (lightColor: string, darkColor: string) =>
    themeWiseColor(lightColor, darkColor, themeMode);

  const processColor = (color: string | undefined, fallback?: string) =>
    color || fallback || token.colorPrimary;

  const handleProjectHover = React.useCallback((project_id: string) => {
    if (project_id) {
      import('@/pages/projects/projectView/project-view').catch(() => {});
    }
  }, []);

  const handleSettingsClick = (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    if (!project?.id || project?.is_guest) return;  // ✅ Prevent opening settings for guests
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
        dispatch(openProjectSettingsModal());
      })
      .catch(() => {
        dispatch(setProjectData(project));
        dispatch(openProjectSettingsModal());
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

  // Helper to check if a field is visible
  const isFieldVisible = useCallback(
    (fieldKey: string) => {
      const field = projectListFields.find(f => f.key === fieldKey);
      return field?.visible ?? true;
    },
    [projectListFields]
  );

  // ✅ Column order: Favorite → Name → Client → Priority → Status → Tasks Progress → Category → Last Updated → Actions
  // Sorting: each column below gets a `sorter`. Since every group renders its own
  // <Table> instance, AntD keeps sort state scoped to that instance automatically —
  // sorting one group's table does NOT affect sibling groups.
  const allTableColumns = useMemo(
    () => [
      // 1. Favorite
      {
        title: '',
        key: 'FAVORITE',
        width: 56,
        align: 'center' as const,
        render: (_: any, record: IProjectViewModel) => (
          <ProjectRateCell key={record.id} t={t as any} record={record} />
        ),
      },
      // 2. Name
      {
        title: t('name', { defaultValue: 'Name' }),
        dataIndex: 'name',
        key: 'NAME',
        width: 280,
        sorter: (a: IProjectViewModel, b: IProjectViewModel) =>
          (a.name || '').localeCompare(b.name || ''),
        showSorterTooltip: false,
        render: (text: string, record: IProjectViewModel) => (
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
              <span
                style={{
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'block',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {text}
              </span>
            </Tooltip>
          </div>
        ),
      },
      // 3. Client
      // FIX: projects with an assigned client must always sort above projects
      // without one, in BOTH ascending and descending order. AntD auto-negates
      // a plain comparator's return value on descend, which would flip that
      // presence check along with the alphabetical part. So this column uses
      // `sorter: true` (no auto comparator) — actual sorting happens manually
      // in getSortedProjects, using compareClientPresenceTop, which applies
      // direction only to the alphabetical ordering and keeps "has client"
      // pinned on top regardless of direction.
      {
        title: t('client', { defaultValue: 'Client' }),
        dataIndex: 'client_name',
        key: 'CLIENT',
        sorter: true,
        showSorterTooltip: false,
        render: (text: string) => text || '—',
      },
      // 4. Priority
      {
        title: t('priority', { defaultValue: 'Priority' }),
        dataIndex: 'priority_name',
        key: 'PRIORITY',
        sorter: (a: IProjectViewModel, b: IProjectViewModel) =>
          (a.priority_name || '').localeCompare(b.priority_name || ''),
        showSorterTooltip: false,
        render: (_: any, record: IProjectViewModel) => {
          if (!record.priority_name) {
            return <span style={{ color: 'var(--ant-color-text-quaternary)' }}>—</span>;
          }
          const background =
            (themeMode === 'dark' ? record.priority_color_dark : record.priority_color) ??
            record.priority_color ??
            'transparent';
          return (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 400,
                background,
                color: '#fff',
              }}
            >
              {record.priority_name}
            </span>
          );
        },
      },
      // 5. Status
      {
        title: t('status', { defaultValue: 'Status' }),
        dataIndex: 'status',
        key: 'STATUS',
        sorter: (a: IProjectViewModel, b: IProjectViewModel) =>
          (a.status || '').localeCompare(b.status || ''),
        showSorterTooltip: false,
        render: (text: string) => text || '—',
      },
      // 6. Tasks Progress
      {
        title: t('tasksProgress', { defaultValue: 'Tasks Progress' }),
        key: 'TASKS_PROGRESS',
        sorter: (a: IProjectViewModel, b: IProjectViewModel) => {
          const pctA =
            (a as any).all_tasks_count > 0
              ? (a as any).completed_tasks_count / (a as any).all_tasks_count
              : 0;
          const pctB =
            (b as any).all_tasks_count > 0
              ? (b as any).completed_tasks_count / (b as any).all_tasks_count
              : 0;
          return pctA - pctB;
        },
        showSorterTooltip: false,
        render: (_: any, record: IProjectViewModel) => {
          const completed = (record as any)?.completed_tasks_count || 0;
          const total = (record as any)?.all_tasks_count || 0;
          const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
          return (
            <Tooltip title={`${completed} / ${total} tasks completed.`}>
              <Progress percent={percent} size="small" />
            </Tooltip>
          );
        },
      },
      // 7. Category
      // FIX: same "always on top regardless of direction" requirement as
      // Client above. Uses `sorter: true` — sorting handled manually in
      // getSortedProjects via compareCategoryPresenceTop.
      {
        title: t('category', { defaultValue: 'Category' }),
        dataIndex: 'category_name',
        key: 'CATEGORY',
        sorter: true,
        showSorterTooltip: false,
        render: (text: string, record: IProjectViewModel) => {
          if (!text || text === '-') return <>-</>;
          const bgColor = record.category_color || '#ff9c3c';
          const textColor = getContrastColor(bgColor);
          return (
            <Tag
              style={{
                backgroundColor: bgColor,
                color: textColor,
                border: 'none',
              }}
            >
              {text}
            </Tag>
          );
        },
      },
      // 8. Last Updated
      {
        title: t('updated_at', { defaultValue: 'Last Updated' }),
        dataIndex: 'updated_at',
        key: 'UPDATED_AT',
        width: 160,
        sorter: (a: IProjectViewModel, b: IProjectViewModel) =>
          new Date((a as any).updated_at).getTime() - new Date((b as any).updated_at).getTime(),
        showSorterTooltip: false,
        render: (_: any, record: IProjectViewModel) => <ProjectListUpdatedAt record={record} />,
      },
      // 9. End Date (hidden by default)
      {
        title: t('endDate', { defaultValue: 'Project End Date' }),
        dataIndex: 'end_date',
        key: 'END_DATE',
        sorter: (a: IProjectViewModel, b: IProjectViewModel) =>
          new Date((a as any).end_date).getTime() - new Date((b as any).end_date).getTime(),
        showSorterTooltip: false,
        render: (_: any, record: IProjectViewModel) => (
          <span>{record.end_date ? simpleDateFormat(record.end_date) : '-'}</span>
        ),
      },
      // 10. Actions
      {
        title: '',
        key: 'actions',
        width: 76,
        align: 'center' as const,
        render: (_: any, record: IProjectViewModel) => {
          const isGuest = record.is_guest === true;
          
          return (
            <Space size={4} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <Tooltip 
                title={
                  isGuest
                    ? t('settingsDisabledForGuest', { defaultValue: 'Project settings are not accessible for guest users' })
                    : t('setting', { defaultValue: 'Settings' })
                }
              >
                <button
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: isGuest ? 'not-allowed' : 'pointer', 
                    padding: '2px 6px',
                    opacity: isGuest ? 0.5 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '28px',
                    height: '28px',
                    fontSize: '14px'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    !isGuest && handleSettingsClick(e, record);
                  }}
                  disabled={isGuest}
                  type="button"
                >
                  <SettingOutlined />
                </button>
              </Tooltip>
              <Tooltip
                title={isOwnerOrAdmin ? (record.archived ? t('unarchive') : t('archive')) : t('noPermission')}
              >
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: isOwnerOrAdmin ? 'pointer' : 'not-allowed',
                    opacity: isOwnerOrAdmin ? 1 : 0.5,
                    padding: '2px 6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '28px',
                    height: '28px',
                    fontSize: '14px'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isOwnerOrAdmin) {
                      handleArchiveClick(record.id);
                    }
                  }}
                  disabled={!isOwnerOrAdmin}
                  type="button"
                >
                  <InboxOutlined />
                </button>
              </Tooltip>
            </Space>
          );
        },
      },
    ],
    [token, t, themeMode, isOwnerOrAdmin]
  );

  // Filter columns based on field visibility
  const tableColumns = useMemo(() => {
    return allTableColumns.filter(col => {
      const key = col.key as string;
      // Always show actions column
      if (key === 'actions') return true;
      // Always show name column
      if (key === 'NAME') return true;
      // Check visibility for other columns
      return isFieldVisible(key);
    });
  }, [allTableColumns, isFieldVisible]);

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
      {/* ── Expand All / Collapse All controls ── */}
      {groups.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
          <button
            onClick={handleExpandAll}
            disabled={collapsedGroups.size === 0}
            style={{
              background: 'none',
              border: 'none',
              cursor: collapsedGroups.size === 0 ? 'default' : 'pointer',
              color: collapsedGroups.size === 0 ? token.colorTextDisabled : token.colorPrimary,
              fontSize: 12,
              padding: '2px 4px',
            }}
          >
            Expand All
          </button>
          <span style={{ color: token.colorTextSecondary, fontSize: 12, lineHeight: '22px' }}>|</span>
          <button
            onClick={handleCollapseAll}
            disabled={allCollapsed}
            style={{
              background: 'none',
              border: 'none',
              cursor: allCollapsed ? 'default' : 'pointer',
              color: allCollapsed ? token.colorTextDisabled : token.colorPrimary,
              fontSize: 12,
              padding: '2px 4px',
            }}
          >
            Collapse All
          </button>
        </div>
      )}

      {groups.map((group, groupIndex) => {
        const groupKey = group?.groupKey || String(groupIndex);
        const rawProjects = group?.projects || [];
        const isCollapsed = collapsedGroups.has(groupKey);
        // Apply manual presence-aware sorting when CLIENT or CATEGORY is the
        // active sorted column for this group's table; otherwise leave as-is
        // and let AntD's own column sorter (for other columns) handle it.
        const projects = getSortedProjects(rawProjects, sortStates[groupKey]);

        return (
          <div key={groupKey} style={{ marginBottom: 24 }}>
            {/* ── Clickable group header ── */}
            <div
              onClick={() => toggleGroup(groupKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 24px 10px 16px',
                marginBottom: isCollapsed ? 0 : 8,
                borderRadius: isCollapsed ? token.borderRadius : `${token.borderRadius}px ${token.borderRadius}px 0 0`,
                background: getThemeAwareColor(token.colorFillAlter, token.colorFillSecondary),
                border: `1px solid ${token.colorBorder}`,
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e =>
                ((e.currentTarget as HTMLDivElement).style.background = getThemeAwareColor(
                  token.colorFillSecondary,
                  token.colorFill
                ))
              }
              onMouseLeave={e =>
                ((e.currentTarget as HTMLDivElement).style.background = getThemeAwareColor(
                  token.colorFillAlter,
                  token.colorFillSecondary
                ))
              }
            >
              <Space align="center">
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: token.colorTextSecondary,
                    fontSize: 11,
                    transition: 'transform 0.2s',
                    transform: isCollapsed ? 'rotate(0deg)' : 'rotate(0deg)',
                  }}
                >
                  {isCollapsed ? <RightOutlined /> : <DownOutlined />}
                </span>

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
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <Title level={5} style={{ margin: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {group?.groupName || 'Unnamed Group'}
                  </Title>
                  <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>|</span>
                  <Text style={{ fontSize: 12, color: token.colorTextSecondary, whiteSpace: 'nowrap' }}>
                    {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                  </Text>
                </div>
              </Space>
            </div>

            {/* ── Collapsible table ── */}
            {!isCollapsed && (
              <Table
                columns={tableColumns}
                dataSource={projects.map((p: any) => ({ ...p, key: p?.id }))}
                rowKey="id"
                pagination={false}
                size="small"
                showSorterTooltip={false}
                onChange={(_pagination, _filters, sorter) => handleSortChange(groupKey, sorter)}
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
            )}

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