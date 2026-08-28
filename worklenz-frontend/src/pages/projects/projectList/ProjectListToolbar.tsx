import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AppstoreOutlined,
  Button,
  CloseCircleOutlined,
  ConfigProvider,
  Flex,
  Input,
  SearchOutlined,
  Select,
  SyncOutlined,
  Tag,
  Tooltip,
  UnorderedListOutlined,
} from '@/shared/antd-imports';
import CreateProjectButton from '@/components/projects/project-create-button/project-create-button';
import { ProjectListFieldsDropdown } from '@/components/project-list/project-list-fields-dropdown/project-list-fields-dropdown';
import PillToggle from '@/pages/home/PillToggle';
import { IProjectFilter, ProjectGroupBy, ProjectViewType } from '@/types/project/project.types';

import { MAX_SEARCH_LENGTH, PROJECT_FILTER_SEGMENTS } from './project-list.constants';

// wrap (not horizontal scroll) so every control stays reachable on narrow
// viewports instead of being hidden off-screen behind a scrollbar.
const TOOLBAR_STYLE: React.CSSProperties = { rowGap: 8, width: '100%' };
const GROUP_BY_SELECT_STYLE: React.CSSProperties = { width: 150, flexShrink: 0 };
const SEARCH_INPUT_STYLE: React.CSSProperties = {
  width: 240,
  maxWidth: '100%',
  height: 30,
  fontSize: 12,
  borderRadius: 7,
};
const CREATE_BUTTON_STYLE: React.CSSProperties = {
  height: 30,
  fontSize: 12,
  borderRadius: 7,
  paddingInline: 12,
};
const COMPACT_SELECT_THEME = {
  components: { Select: { controlHeight: 30, fontSize: 12, borderRadius: 7 } },
};

interface ProjectListToolbarProps {
  filterSegment: IProjectFilter;
  viewMode: ProjectViewType;
  groupBy: ProjectGroupBy;
  searchValue: string;
  isRefreshing: boolean;
  isOwnerOrAdmin: boolean;
  /** Count of active Status/Category/Priority/Client column filters. */
  activeFilterCount: number;
  onRefresh: () => void;
  onFilterSegmentChange: (value: IProjectFilter) => void;
  onViewModeChange: (value: ProjectViewType) => void;
  onGroupByChange: (value: ProjectGroupBy) => void;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
}

const ProjectListToolbarComponent: React.FC<ProjectListToolbarProps> = ({
  filterSegment,
  viewMode,
  groupBy,
  searchValue,
  isRefreshing,
  isOwnerOrAdmin,
  activeFilterCount,
  onRefresh,
  onFilterSegmentChange,
  onViewModeChange,
  onGroupByChange,
  onSearchChange,
  onClearFilters,
}) => {
  const { t } = useTranslation('all-project-list');

  const segmentOptions = useMemo(
    () =>
      PROJECT_FILTER_SEGMENTS.map(filter => ({
        value: filter,
        // `filter` itself (e.g. "All"/"Favorites"/"Archived") is already sentence
        // case, so use it as the fallback if the translation lookup ever misses
        // — avoids rendering the lowercase lookup key ("all"/"favorites"/…).
        label: t(filter.toLowerCase(), { defaultValue: filter }),
      })),
    [t]
  );

  const viewToggleOptions = useMemo(
    () => [
      {
        value: ProjectViewType.LIST,
        label: (
          <Tooltip title={t('listView', { defaultValue: 'List View' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UnorderedListOutlined />
              <span>{t('list', { defaultValue: 'List' })}</span>
            </div>
          </Tooltip>
        ),
      },
      {
        value: ProjectViewType.GROUP,
        label: (
          <Tooltip title={t('groupView', { defaultValue: 'Group View' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AppstoreOutlined />
              <span>{t('group', { defaultValue: 'Group' })}</span>
            </div>
          </Tooltip>
        ),
      },
    ],
    [t]
  );

  const groupByOptions = useMemo(
    () => [
      {
        value: ProjectGroupBy.PRIORITY,
        label: t('groupBy.priority', { defaultValue: 'Priority' }),
      },
      {
        value: ProjectGroupBy.CATEGORY,
        label: t('groupBy.category', { defaultValue: 'Category' }),
      },
      { value: ProjectGroupBy.CLIENT, label: t('groupBy.client', { defaultValue: 'Client' }) },
    ],
    [t]
  );

  const refreshLabel = t('refreshProjects', { defaultValue: 'Refresh projects' });

  return (
    <Flex gap={8} align="center" justify="flex-end" wrap="wrap" style={TOOLBAR_STYLE}>
      {/* Refresh button hidden per request — commented out, not removed.
      <Tooltip title={refreshLabel}>
        <Button
          shape="circle"
          icon={<SyncOutlined spin={isRefreshing} />}
          onClick={onRefresh}
          aria-label={refreshLabel}
        />
      </Tooltip>
      */}

      <PillToggle<IProjectFilter>
        value={filterSegment}
        options={segmentOptions}
        onChange={onFilterSegmentChange}
      />
      <PillToggle<ProjectViewType>
        value={viewMode}
        options={viewToggleOptions}
        onChange={onViewModeChange}
      />

      {viewMode === ProjectViewType.GROUP && (
        <ConfigProvider theme={COMPACT_SELECT_THEME}>
          <Select
            value={groupBy}
            onChange={onGroupByChange}
            options={groupByOptions}
            style={GROUP_BY_SELECT_STYLE}
          />
        </ConfigProvider>
      )}

      {activeFilterCount > 0 && (
        // Group view has no per-column filter UI of its own, so a filter
        // carried over from list view would otherwise be invisible there —
        // this is the only indicator (and the only way to clear it) in that view.
        <Tag
          closable
          onClose={onClearFilters}
          closeIcon={<CloseCircleOutlined />}
          style={{ margin: 0, cursor: 'default', flexShrink: 0 }}
        >
          {t('activeFiltersCount', {
            count: activeFilterCount,
            defaultValue: `Filters: ${activeFilterCount}`,
          })}
        </Tag>
      )}

      <ProjectListFieldsDropdown />

      <Input
        placeholder={t('placeholder', { defaultValue: 'Search by project name' })}
        suffix={<SearchOutlined />}
        type="text"
        value={searchValue}
        // Native truncation instead of silently rejecting the whole change —
        // rejecting gave no feedback at all: a paste past the cap looked like
        // a broken keyboard rather than a length limit.
        maxLength={MAX_SEARCH_LENGTH}
        onChange={event => onSearchChange(event.target.value)}
        aria-label={t('searchProjects', { defaultValue: 'Search by project name' })}
        allowClear
        style={SEARCH_INPUT_STYLE}
        onClear={() => onSearchChange('')}
      />

      {isOwnerOrAdmin && <CreateProjectButton style={CREATE_BUTTON_STYLE} />}
    </Flex>
  );
};

export const ProjectListToolbar = React.memo(ProjectListToolbarComponent);
ProjectListToolbar.displayName = 'ProjectListToolbar';
