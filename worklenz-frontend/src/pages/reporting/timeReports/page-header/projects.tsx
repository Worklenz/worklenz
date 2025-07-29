import {
  setSelectOrDeselectAllProjects,
  setSelectOrDeselectProject,
} from '@/features/reporting/time-reports/time-reports-overview.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  CaretDownFilled,
  SearchOutlined,
  ClearOutlined,
  DownOutlined,
  RightOutlined,
  FilterOutlined,
} from '@/shared/antd-imports';
import {
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Input,
  theme,
  Typography,
  Badge,
  Collapse,
  Select,
  Space,
  Tooltip,
  Empty,
} from '@/shared/antd-imports';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ISelectableProject } from '@/types/reporting/reporting-filters.types';
import { themeWiseColor } from '@/utils/themeWiseColor';

const { Panel } = Collapse;
const { Text } = Typography;

type GroupByOption = 'none' | 'category' | 'team' | 'status';

interface ProjectGroup {
  key: string;
  name: string;
  color?: string;
  projects: ISelectableProject[];
}

const Projects: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchText, setSearchText] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const { t } = useTranslation('time-report');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const { projects, loadingProjects } = useAppSelector(state => state.timeReportsOverviewReducer);
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Theme-aware color utilities
  const getThemeAwareColor = useCallback(
    (lightColor: string, darkColor: string) => {
      return themeWiseColor(lightColor, darkColor, themeMode);
    },
    [themeMode]
  );

  // Enhanced color processing for project/group colors
  const processColor = useCallback(
    (color: string | undefined, fallback?: string) => {
      if (!color) return fallback || token.colorPrimary;

      // If it's a hex color, ensure it has good contrast in both themes
      if (color.startsWith('#')) {
        // For dark mode, lighten dark colors and darken light colors for better visibility
        if (themeMode === 'dark') {
          // Simple brightness adjustment for dark mode
          const hex = color.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);

          // Calculate brightness (0-255)
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;

          // If color is too dark in dark mode, lighten it
          if (brightness < 100) {
            const factor = 1.5;
            const newR = Math.min(255, Math.floor(r * factor));
            const newG = Math.min(255, Math.floor(g * factor));
            const newB = Math.min(255, Math.floor(b * factor));
            return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
          }
        } else {
          // For light mode, ensure colors aren't too light
          const hex = color.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);

          const brightness = (r * 299 + g * 587 + b * 114) / 1000;

          // If color is too light in light mode, darken it
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
    },
    [themeMode, token.colorPrimary]
  );

  // Memoized filtered projects
  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(item =>
      item.name?.toLowerCase().includes(searchText.toLowerCase())
    );

    if (showSelectedOnly) {
      filtered = filtered.filter(item => item.selected);
    }

    return filtered;
  }, [projects, searchText, showSelectedOnly]);

  // Memoized grouped projects
  const groupedProjects = useMemo(() => {
    if (groupBy === 'none') {
      return [
        {
          key: 'all',
          name: t('projects'),
          projects: filteredProjects,
        },
      ];
    }

    const groups: { [key: string]: ProjectGroup } = {};

    filteredProjects.forEach(project => {
      let groupKey: string;
      let groupName: string;
      let groupColor: string | undefined;

      switch (groupBy) {
        case 'category':
          groupKey = (project as any).category_id || 'uncategorized';
          groupName = (project as any).category_name || t('noCategory');
          groupColor = (project as any).category_color;
          break;
        case 'team':
          groupKey = (project as any).team_id || 'no-team';
          groupName = (project as any).team_name || t('ungrouped');
          groupColor = (project as any).team_color;
          break;
        case 'status':
          groupKey = (project as any).status_id || 'no-status';
          groupName = (project as any).status_name || t('ungrouped');
          groupColor = (project as any).status_color;
          break;
        default:
          groupKey = 'all';
          groupName = t('projects');
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          name: groupName,
          color: processColor(groupColor),
          projects: [],
        };
      }

      groups[groupKey].projects.push(project);
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredProjects, groupBy, t, processColor]);

  // Selected projects count
  const selectedCount = useMemo(() => projects.filter(p => p.selected).length, [projects]);

  const allSelected = useMemo(
    () => filteredProjects.length > 0 && filteredProjects.every(p => p.selected),
    [filteredProjects]
  );

  const indeterminate = useMemo(
    () => filteredProjects.some(p => p.selected) && !allSelected,
    [filteredProjects, allSelected]
  );

  // Memoize group by options
  const groupByOptions = useMemo(
    () => [
      { value: 'none', label: t('groupByNone') },
      { value: 'category', label: t('groupByCategory') },
      { value: 'team', label: t('groupByTeam') },
      { value: 'status', label: t('groupByStatus') },
    ],
    [t]
  );

  // Memoize dropdown styles to prevent recalculation on every render
  const dropdownStyles = useMemo(
    () => ({
      dropdown: {
        background: token.colorBgContainer,
        borderRadius: token.borderRadius,
        boxShadow: token.boxShadowSecondary,
        border: `1px solid ${token.colorBorder}`,
      },
      groupHeader: {
        backgroundColor: getThemeAwareColor(token.colorFillTertiary, token.colorFillQuaternary),
        borderRadius: token.borderRadiusSM,
        padding: '8px 12px',
        marginBottom: '4px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: `1px solid ${getThemeAwareColor(token.colorBorderSecondary, token.colorBorder)}`,
      },
      projectItem: {
        padding: '8px 12px',
        borderRadius: token.borderRadiusSM,
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        border: `1px solid transparent`,
      },
      toggleIcon: {
        color: getThemeAwareColor(token.colorTextSecondary, token.colorTextTertiary),
        fontSize: '12px',
        transition: 'all 0.2s ease',
      },
      expandedToggleIcon: {
        color: getThemeAwareColor(token.colorPrimary, token.colorPrimaryActive),
        fontSize: '12px',
        transition: 'all 0.2s ease',
      },
    }),
    [token, getThemeAwareColor]
  );

  // Memoize search placeholder and clear tooltip
  const searchPlaceholder = useMemo(() => t('searchByProject'), [t]);
  const clearTooltip = useMemo(() => t('clearSearch'), [t]);
  const showSelectedTooltip = useMemo(() => t('showSelected'), [t]);
  const selectAllText = useMemo(() => t('selectAll'), [t]);
  const projectsSelectedText = useMemo(() => t('projectsSelected'), [t]);
  const noProjectsText = useMemo(() => t('noProjects'), [t]);
  const noDataText = useMemo(() => t('noData'), [t]);
  const expandAllText = useMemo(() => t('expandAll'), [t]);
  const collapseAllText = useMemo(() => t('collapseAll'), [t]);

  // Handle checkbox change for individual items
  const handleCheckboxChange = useCallback(
    (key: string, checked: boolean) => {
      dispatch(setSelectOrDeselectProject({ id: key, selected: checked }));
    },
    [dispatch]
  );

  // Handle "Select All" checkbox change
  const handleSelectAllChange = useCallback(
    (e: CheckboxChangeEvent) => {
      const isChecked = e.target.checked;
      dispatch(setSelectOrDeselectAllProjects(isChecked));
    },
    [dispatch]
  );

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchText('');
  }, []);

  // Toggle group expansion
  const toggleGroupExpansion = useCallback((groupKey: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupKey) ? prev.filter(key => key !== groupKey) : [...prev, groupKey]
    );
  }, []);

  // Expand/Collapse all groups
  const toggleAllGroups = useCallback(
    (expand: boolean) => {
      if (expand) {
        setExpandedGroups(groupedProjects.map(g => g.key));
      } else {
        setExpandedGroups([]);
      }
    },
    [groupedProjects]
  );

  // Render project group
  const renderProjectGroup = (group: ProjectGroup) => {
    const isExpanded = expandedGroups.includes(group.key) || groupBy === 'none';
    const groupSelectedCount = group.projects.filter(p => p.selected).length;

    return (
      <div key={group.key} style={{ marginBottom: '8px' }}>
        {groupBy !== 'none' && (
          <div
            style={{
              ...dropdownStyles.groupHeader,
              backgroundColor: isExpanded
                ? getThemeAwareColor(token.colorFillSecondary, token.colorFillTertiary)
                : dropdownStyles.groupHeader.backgroundColor,
            }}
            onClick={() => toggleGroupExpansion(group.key)}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = getThemeAwareColor(
                token.colorFillSecondary,
                token.colorFillTertiary
              );
              e.currentTarget.style.borderColor = getThemeAwareColor(
                token.colorBorder,
                token.colorBorderSecondary
              );
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = isExpanded
                ? getThemeAwareColor(token.colorFillSecondary, token.colorFillTertiary)
                : dropdownStyles.groupHeader.backgroundColor;
              e.currentTarget.style.borderColor = getThemeAwareColor(
                token.colorBorderSecondary,
                token.colorBorder
              );
            }}
          >
            <Space>
              {isExpanded ? (
                <DownOutlined style={dropdownStyles.expandedToggleIcon} />
              ) : (
                <RightOutlined style={dropdownStyles.toggleIcon} />
              )}
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: group.color || processColor(undefined, token.colorPrimary),
                  flexShrink: 0,
                  border: `1px solid ${getThemeAwareColor('rgba(0,0,0,0.1)', 'rgba(255,255,255,0.2)')}`,
                }}
              />
              <Text
                strong
                style={{
                  color: getThemeAwareColor(token.colorText, token.colorTextBase),
                }}
              >
                {group.name}
              </Text>
              <Badge
                count={groupSelectedCount}
                size="small"
                style={{
                  backgroundColor: getThemeAwareColor(token.colorPrimary, token.colorPrimaryActive),
                  color: getThemeAwareColor('#fff', token.colorTextLightSolid),
                }}
              />
            </Space>
          </div>
        )}

        {isExpanded && (
          <div style={{ paddingLeft: groupBy !== 'none' ? '24px' : '0' }}>
            {group.projects.map(project => (
              <div
                key={project.id}
                style={dropdownStyles.projectItem}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = getThemeAwareColor(
                    token.colorFillAlter,
                    token.colorFillQuaternary
                  );
                  e.currentTarget.style.borderColor = getThemeAwareColor(
                    token.colorBorderSecondary,
                    token.colorBorder
                  );
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <Checkbox
                  onClick={e => e.stopPropagation()}
                  checked={project.selected}
                  onChange={e => handleCheckboxChange(project.id || '', e.target.checked)}
                >
                  <Space>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: processColor(
                          (project as any).color_code,
                          token.colorPrimary
                        ),
                        flexShrink: 0,
                        border: `1px solid ${getThemeAwareColor('rgba(0,0,0,0.1)', 'rgba(255,255,255,0.2)')}`,
                      }}
                    />
                    <Text
                      style={{
                        color: getThemeAwareColor(token.colorText, token.colorTextBase),
                      }}
                    >
                      {project.name}
                    </Text>
                  </Space>
                </Checkbox>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <Dropdown
        menu={undefined}
        placement="bottomLeft"
        trigger={['click']}
        open={dropdownVisible}
        dropdownRender={() => (
          <div
            style={{
              ...dropdownStyles.dropdown,
              padding: '8px 0',
              maxHeight: '500px',
              width: '400px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header with search and controls */}
            <div style={{ padding: '8px 12px', flexShrink: 0 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {/* Search input */}
                <Input
                  placeholder={searchPlaceholder}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  prefix={
                    <SearchOutlined
                      style={{
                        color: getThemeAwareColor(
                          token.colorTextTertiary,
                          token.colorTextQuaternary
                        ),
                      }}
                    />
                  }
                  suffix={
                    searchText && (
                      <Tooltip title={clearTooltip}>
                        <ClearOutlined
                          onClick={clearSearch}
                          style={{
                            cursor: 'pointer',
                            color: getThemeAwareColor(
                              token.colorTextTertiary,
                              token.colorTextQuaternary
                            ),
                            transition: 'color 0.2s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = getThemeAwareColor(
                              token.colorTextSecondary,
                              token.colorTextTertiary
                            );
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = getThemeAwareColor(
                              token.colorTextTertiary,
                              token.colorTextQuaternary
                            );
                          }}
                        />
                      </Tooltip>
                    )
                  }
                  onClick={e => e.stopPropagation()}
                />

                {/* Controls row */}
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space size="small">
                    <Select
                      value={groupBy}
                      onChange={setGroupBy}
                      size="small"
                      style={{ width: '120px' }}
                      options={groupByOptions}
                    />

                    {groupBy !== 'none' && (
                      <Space size="small">
                        <Button
                          type="text"
                          size="small"
                          onClick={() => toggleAllGroups(true)}
                          style={{
                            color: getThemeAwareColor(
                              token.colorTextSecondary,
                              token.colorTextTertiary
                            ),
                          }}
                        >
                          {expandAllText}
                        </Button>
                        <Button
                          type="text"
                          size="small"
                          onClick={() => toggleAllGroups(false)}
                          style={{
                            color: getThemeAwareColor(
                              token.colorTextSecondary,
                              token.colorTextTertiary
                            ),
                          }}
                        >
                          {collapseAllText}
                        </Button>
                      </Space>
                    )}
                  </Space>

                  <Tooltip title={showSelectedTooltip}>
                    <Button
                      type={showSelectedOnly ? 'primary' : 'text'}
                      size="small"
                      icon={<FilterOutlined />}
                      onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                      style={
                        !showSelectedOnly
                          ? {
                              color: getThemeAwareColor(
                                token.colorTextSecondary,
                                token.colorTextTertiary
                              ),
                            }
                          : {}
                      }
                    />
                  </Tooltip>
                </Space>
              </Space>
            </div>

            {/* Select All checkbox */}
            <div style={{ padding: '8px 12px', flexShrink: 0 }}>
              <Checkbox
                onClick={e => e.stopPropagation()}
                onChange={handleSelectAllChange}
                checked={allSelected}
                indeterminate={indeterminate}
              >
                <Space>
                  <Text
                    style={{
                      color: getThemeAwareColor(token.colorText, token.colorTextBase),
                    }}
                  >
                    {selectAllText}
                  </Text>
                  {selectedCount > 0 && (
                    <Badge
                      count={selectedCount}
                      size="small"
                      style={{
                        backgroundColor: getThemeAwareColor(
                          token.colorSuccess,
                          token.colorSuccessActive
                        ),
                        color: getThemeAwareColor('#fff', token.colorTextLightSolid),
                      }}
                    />
                  )}
                </Space>
              </Checkbox>
            </div>

            <Divider style={{ margin: '8px 0', flexShrink: 0 }} />

            {/* Projects list */}
            <div
              style={{
                overflowY: 'auto',
                flex: 1,
                padding: '0 12px',
              }}
            >
              {filteredProjects.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Text
                      style={{
                        color: getThemeAwareColor(
                          token.colorTextTertiary,
                          token.colorTextQuaternary
                        ),
                      }}
                    >
                      {searchText ? noProjectsText : noDataText}
                    </Text>
                  }
                  style={{ margin: '20px 0' }}
                />
              ) : (
                groupedProjects.map(renderProjectGroup)
              )}
            </div>

            {/* Footer with selection summary */}
            {selectedCount > 0 && (
              <>
                <Divider style={{ margin: '8px 0', flexShrink: 0 }} />
                <div
                  style={{
                    padding: '8px 12px',
                    flexShrink: 0,
                    backgroundColor: getThemeAwareColor(
                      token.colorFillAlter,
                      token.colorFillQuaternary
                    ),
                    borderRadius: `0 0 ${token.borderRadius}px ${token.borderRadius}px`,
                    borderTop: `1px solid ${getThemeAwareColor(token.colorBorderSecondary, token.colorBorder)}`,
                  }}
                >
                  <Text
                    type="secondary"
                    style={{
                      fontSize: '12px',
                      color: getThemeAwareColor(token.colorTextTertiary, token.colorTextQuaternary),
                    }}
                  >
                    {selectedCount} {projectsSelectedText}
                  </Text>
                </div>
              </>
            )}
          </div>
        )}
        onOpenChange={visible => {
          setDropdownVisible(visible);
          if (!visible) {
            setSearchText('');
            setShowSelectedOnly(false);
          }
        }}
      >
        <Badge count={selectedCount} size="small" offset={[-5, 5]}>
          <Button loading={loadingProjects}>
            <Space>
              {t('projects')}
              <CaretDownFilled />
            </Space>
          </Button>
        </Badge>
      </Dropdown>
    </div>
  );
};

export default Projects;
