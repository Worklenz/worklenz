import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CloseOutlined,
  Empty,
  Flex,
  Input,
  Result,
  SearchOutlined,
  Table,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSoftwareReport } from '@/hooks/useSoftwareReport';
import { softwareIssuesApiService } from '@/api/software-issues/software-issues.api.service';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import {
  SoftwareQuickFilter,
  resetSoftwareQuickFilters,
} from '@/features/projects/singleProject/quick-filters/software-quick-filters.slice';
import { SoftwareQuickFilterChips } from '@/components/task-management/improved-task-filters/software-quick-filter-chips';
import {
  WorkItemAssignee,
  WorkItemEpic,
  WorkItemStatus,
  WorkItemSummary,
} from '@/components/projects/releases/release-work-item-parts';
import { formatStoryPoints } from '@/lib/project/story-points';
import { getSoftwareProjectLabels } from '@/lib/project/software-project';
import { ISoftwareWorkItem } from '@/types/project/softwareIssue.types';

interface EpicFilter {
  id: string;
  name: string;
}

/** Flat, filterable list of every work item in a software project. */
const ProjectViewSoftwareList = () => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const { projectId } = useParams<{ projectId: string }>();
  const projectType = useAppSelector(state => state.projectReducer.project?.project_type);
  const quickFilters = useAppSelector(state => state.softwareQuickFiltersReducer.active);
  const isDrawerOpen = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);
  const [searchText, setSearchText] = useState('');
  const [epicFilter, setEpicFilter] = useState<EpicFilter | null>(null);

  const { data, isLoading, hasError, reload } = useSoftwareReport<ISoftwareWorkItem[]>(
    projectId ? `software-list:${projectId}` : null,
    () => softwareIssuesApiService.getWorkItems(projectId as string)
  );

  useReloadWhenDrawerCloses(isDrawerOpen, reload);

  const filteredItems = useMemo(
    () => filterWorkItems(data ?? [], searchText, quickFilters, epicFilter?.id ?? null),
    [data, searchText, quickFilters, epicFilter]
  );

  const hasActiveFilters = !!searchText.trim() || quickFilters.length > 0 || !!epicFilter;
  const sprintLabel = getSoftwareProjectLabels(projectType).phase;

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) =>
    setSearchText(event.target.value);

  const handleClearFilters = () => {
    setSearchText('');
    setEpicFilter(null);
    dispatch(resetSoftwareQuickFilters());
  };

  const handleOpenItem = useCallback(
    (item: ISoftwareWorkItem) => {
      dispatch(setSelectedTaskId(item.id));
      dispatch(setShowTaskDrawer(true));
    },
    [dispatch]
  );

  const columns = useMemo<TableColumnsType<ISoftwareWorkItem>>(
    () => [
      {
        key: 'work',
        title: t('listColumnWorkItem', { defaultValue: 'Work item' }),
        render: (_, item) => (
          <WorkItemSummary
            item={item}
            onOpen={workItem => handleOpenItem(workItem as ISoftwareWorkItem)}
          />
        ),
      },
      {
        key: 'status',
        title: t('listColumnStatus', { defaultValue: 'Status' }),
        width: 140,
        render: (_, item) => <WorkItemStatus item={item} />,
      },
      {
        key: 'sprint',
        title: sprintLabel,
        width: 140,
        ellipsis: true,
        render: (_, item) =>
          item.sprint_name ? (
            <span className="text-xs">{item.sprint_name}</span>
          ) : (
            <Typography.Text type="secondary" className="text-xs">
              {t('listNoSprint', { defaultValue: 'Backlog' })}
            </Typography.Text>
          ),
      },
      {
        key: 'epic',
        title: t('listColumnEpic', { defaultValue: 'Epic' }),
        width: 170,
        render: (_, item) =>
          item.epic_id && item.epic_name ? (
            <button
              type="button"
              className="flex w-full min-w-0 overflow-hidden border-0 bg-transparent p-0 cursor-pointer text-left hover:underline focus-visible:outline focus-visible:outline-2"
              title={item.epic_name}
              aria-label={t('listFilterByEpic', {
                defaultValue: 'Show only {{name}}',
                name: item.epic_name,
              })}
              onClick={() => setEpicFilter({ id: item.epic_id as string, name: item.epic_name as string })}
            >
              <WorkItemEpic item={item} />
            </button>
          ) : (
            <WorkItemEpic item={item} />
          ),
      },
      {
        key: 'assignee',
        title: t('listColumnAssignee', { defaultValue: 'Assignee' }),
        width: 140,
        render: (_, item) => <WorkItemAssignee item={item} />,
      },
      {
        key: 'priority',
        title: t('listColumnPriority', { defaultValue: 'Priority' }),
        width: 110,
        render: (_, item) => <WorkItemPriority item={item} />,
      },
      {
        key: 'points',
        title: t('listColumnPoints', { defaultValue: 'Points' }),
        width: 80,
        align: 'center',
        render: (_, item) =>
          item.story_points === null ? (
            <Typography.Text type="secondary">–</Typography.Text>
          ) : (
            <strong>{formatStoryPoints(item.story_points)}</strong>
          ),
      },
    ],
    [handleOpenItem, sprintLabel, t]
  );

  if (hasError && !data) {
    return (
      <Result
        status="warning"
        title={t('listLoadError', { defaultValue: 'Could not load work items' })}
        extra={<Button onClick={reload}>{t('retry', { defaultValue: 'Retry' })}</Button>}
      />
    );
  }

  return (
    <Flex vertical gap={13}>
      <Flex align="center" gap={8} wrap="wrap">
        <Input
          allowClear
          value={searchText}
          onChange={handleSearchChange}
          prefix={<SearchOutlined style={{ color: token.colorTextSecondary }} />}
          placeholder={t('listSearchPlaceholder', { defaultValue: 'Search work…' })}
          aria-label={t('listSearchLabel', { defaultValue: 'Search work' })}
          className="flex-1 min-w-[200px]"
          style={{ height: 30 }}
        />
        <SoftwareQuickFilterChips onChange={noop} />
        {epicFilter && (
          <Button
            size="small"
            color="primary"
            variant="outlined"
            icon={<CloseOutlined />}
            iconPosition="end"
            onClick={() => setEpicFilter(null)}
            aria-label={t('listClearEpicFilter', {
              defaultValue: 'Remove epic filter {{name}}',
              name: epicFilter.name,
            })}
            style={{ height: 30, background: token.colorPrimaryBg }}
          >
            {t('listEpicFilter', { defaultValue: 'Epic: {{name}}', name: epicFilter.name })}
          </Button>
        )}
        {hasActiveFilters && (
          <Button size="small" onClick={handleClearFilters} style={{ height: 30 }}>
            {t('listClearFilters', { defaultValue: 'Clear' })}
          </Button>
        )}
      </Flex>

      <div
        className="overflow-hidden"
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
        }}
      >
        <Table<ISoftwareWorkItem>
          rowKey="id"
          size="small"
          tableLayout="fixed"
          columns={columns}
          dataSource={filteredItems}
          loading={isLoading}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 50, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  hasActiveFilters
                    ? t('listEmptyFiltered', { defaultValue: 'No work items match these filters' })
                    : t('listEmpty', {
                        defaultValue: 'No work items yet. Use Create to add the first one.',
                      })
                }
              />
            ),
          }}
        />
      </div>
    </Flex>
  );
};

const WorkItemPriority = ({ item }: { item: ISoftwareWorkItem }) => {
  const { token } = theme.useToken();
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');
  if (!item.priority_name) {
    return <Typography.Text type="secondary">–</Typography.Text>;
  }

  const color =
    (isDarkMode ? item.priority_color_dark : item.priority_color) ??
    item.priority_color ??
    token.colorTextSecondary;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize" style={{ color }}>
      <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {item.priority_name}
    </span>
  );
};

/** Reloads the list after the task drawer closes, so edits made there show up. */
const useReloadWhenDrawerCloses = (isDrawerOpen: boolean, reload: () => void) => {
  const wasOpenRef = useRef(isDrawerOpen);
  useEffect(() => {
    if (wasOpenRef.current && !isDrawerOpen) reload();
    wasOpenRef.current = isDrawerOpen;
  }, [isDrawerOpen, reload]);
};

const filterWorkItems = (
  items: ISoftwareWorkItem[],
  searchText: string,
  quickFilters: SoftwareQuickFilter[],
  epicId: string | null
): ISoftwareWorkItem[] => {
  const query = searchText.trim().toLowerCase();
  return items.filter(
    item =>
      (!query ||
        item.name.toLowerCase().includes(query) ||
        item.task_key.toLowerCase().includes(query)) &&
      (!quickFilters.includes('mine') || item.is_mine) &&
      (!quickFilters.includes('bugs') || item.issue_type === 'bug') &&
      (!quickFilters.includes('blocked') || item.is_blocked) &&
      (!epicId || item.epic_id === epicId)
  );
};

const noop = () => undefined;

export default ProjectViewSoftwareList;
