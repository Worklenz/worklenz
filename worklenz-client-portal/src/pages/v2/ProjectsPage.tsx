import React, { useCallback, useMemo, useState } from 'react';
import {
  Card,
  EyeOutlined,
  MessageOutlined,
  PaperClipOutlined,
  Progress,
  Table,
  Tag,
  TeamOutlined,
  Typography,
} from '@/shared/antd-imports';
import type { TableColumnsType } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetProjectsPageQuery } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useFormatters } from '@/hooks/useFormatters';
import {
  EmptyState,
  ListToolbar,
  PageHeader,
  ProjectName,
  QueryState,
  RowActions,
  StatusTag,
  TablePagination,
  clickableRow,
  tableBodyHeight,
  withHeaderMinWidth,
  useColumnVisibility,
  useDebouncedValue,
  usePortalSort,
} from '@/components/v2';
import type { ColumnField, FilterGroup, RowAction } from '@/components/v2';
import type { ClientProjectV2, ProjectStatus } from '@/types/v2';
import { toModalTab, type ProjectModalIntent, type ProjectModalTab } from '@/utils/targets';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { ProjectModal } from './project/ProjectModal';

const TABLE_BODY_HEIGHT = tableBodyHeight(380);
const HIDDEN_COLUMNS_KEY = 'worklenz.clientportal.projects.hiddenColumns';
const PROJECT_STATUSES: ProjectStatus[] = ['on_track', 'at_risk', 'on_hold', 'completed'];
const STATUS_LABELS: Record<ProjectStatus, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  on_hold: 'On hold',
  completed: 'Completed',
};

/** The projects the team has shared with this client (spec #2532). A row opens the project in a dialog. */
export const ProjectsPage: React.FC = () => {
  const { t } = useTranslation();
  const { date } = useFormatters();
  const { can } = useClientAccess();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [phaseFilter, setPhaseFilter] = useState<string[]>([]);
  const [intent, setIntent] = useState<ProjectModalIntent | undefined>();
  const sorting = usePortalSort();
  const columnVisibility = useColumnVisibility(HIDDEN_COLUMNS_KEY);
  const search = useDebouncedValue(searchText.trim());

  const query = useGetProjectsPageQuery({
    page,
    size,
    search,
    sort: sorting.sort,
    order: sorting.order,
    status: statusFilter,
    phase: phaseFilter,
  });
  const projects = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const isFiltered = Boolean(search) || statusFilter.length > 0 || phaseFilter.length > 0;

  const openProjectId = searchParams.get('project');
  const openTab = toModalTab(searchParams.get('tab'));

  const openProject = useCallback(
    (projectId: string, tab: ProjectModalTab = 'overview', nextIntent?: ProjectModalIntent) => {
      setIntent(nextIntent);
      const next = new URLSearchParams(searchParams);
      next.set('project', projectId);
      next.set('tab', tab);
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const changeTab = (tab: ProjectModalTab) => {
    setIntent(undefined);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const closeProject = () => {
    setIntent(undefined);
    const next = new URLSearchParams(searchParams);
    ['project', 'tab', 'file', 'thread', 'task', 'ms'].forEach(key => next.delete(key));
    setSearchParams(next);
  };

  const resetPage = () => setPage(1);

  const actionItems = (project: ClientProjectV2): RowAction[] => [
    { key: 'view', icon: <EyeOutlined />, label: t('projects.actionMenu.view', { defaultValue: 'View details' }) },
    {
      key: 'members',
      icon: <TeamOutlined />,
      disabled: !can.manageUsers,
      label: t('projects.actionMenu.members', { defaultValue: 'Assign / remove member' }),
    },
    {
      key: 'attachment',
      icon: <PaperClipOutlined />,
      disabled: !(can.upload && project.allow_uploads),
      label: t('projects.actionMenu.attachment', { defaultValue: 'Add attachment' }),
    },
    {
      key: 'discussion',
      icon: <MessageOutlined />,
      disabled: !can.comment,
      label: t('projects.actionMenu.discussion', { defaultValue: 'Start discussion' }),
    },
  ];

  const runAction = (project: ClientProjectV2, key: string) => {
    if (key === 'view') openProject(project.id, 'overview');
    if (key === 'members') openProject(project.id, 'members');
    if (key === 'attachment') openProject(project.id, 'files', 'upload');
    if (key === 'discussion') openProject(project.id, 'discussions', 'discussion');
  };

  const columns: TableColumnsType<ClientProjectV2> = [
    {
      title: t('projects.project', { defaultValue: 'Project' }),
      key: 'name',
      dataIndex: 'name',
      ...sorting.columnProps('name'),
      render: (_: string, project) => <ProjectName name={project.name} color={project.color} />,
    },
    {
      title: t('projects.status', { defaultValue: 'Status' }),
      key: 'status',
      dataIndex: 'status',
      ...sorting.columnProps('status'),
      render: (status: string) => <StatusTag kind="project" status={status} />,
    },
    {
      title: t('projects.phase', { defaultValue: 'Phase' }),
      key: 'phase',
      dataIndex: 'phase',
      responsive: ['md'],
      ...sorting.columnProps('phase'),
      render: (phase: string | null) => decodeHtmlEntities(phase ?? undefined) || '—',
    },
    {
      title: t('projects.progress', { defaultValue: 'Progress' }),
      key: 'progress',
      dataIndex: 'progress',
      responsive: ['md'],
      width: 170,
      ...sorting.columnProps('progress'),
      render: (progress: number, project) => (
        <Progress percent={progress} size="small" strokeColor={project.color ?? undefined} />
      ),
    },
    {
      title: t('projects.expectedCompletion', { defaultValue: 'Expected completion' }),
      key: 'expected_completion',
      dataIndex: 'expected_completion',
      responsive: ['lg'],
      ...sorting.columnProps('expected_completion'),
      render: (value: string | null) => date(value),
    },
    {
      title: t('projects.contact', { defaultValue: 'Project contact' }),
      key: 'contact',
      dataIndex: 'primary_contact',
      responsive: ['lg'],
      render: (value: string | null) => decodeHtmlEntities(value ?? undefined) || '—',
    },
    {
      title: t('projects.openItems', { defaultValue: 'Open items' }),
      key: 'open_items',
      responsive: ['md'],
      render: (_: unknown, project) => {
        const open = (project.open_approvals ?? 0) + (project.open_change_requests ?? 0);
        return open > 0 ? <Tag color="orange">{open}</Tag> : <Typography.Text type="secondary">—</Typography.Text>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_: unknown, project) => (
        <RowActions name={decodeHtmlEntities(project.name)} actions={actionItems(project)} onSelect={key => runAction(project, key)} />
      ),
    },
  ];

  const fields: ColumnField[] = [
    { key: 'status', label: t('projects.status', { defaultValue: 'Status' }) },
    { key: 'phase', label: t('projects.phase', { defaultValue: 'Phase' }) },
    { key: 'progress', label: t('projects.progress', { defaultValue: 'Progress' }) },
    { key: 'expected_completion', label: t('projects.expectedCompletion', { defaultValue: 'Expected completion' }) },
    { key: 'contact', label: t('projects.contact', { defaultValue: 'Project contact' }) },
    { key: 'open_items', label: t('projects.openItems', { defaultValue: 'Open items' }) },
  ];

  const filterGroups: FilterGroup[] = useMemo(
    () => [
      {
        key: 'status',
        label: t('projects.status', { defaultValue: 'Status' }),
        options: PROJECT_STATUSES.map(status => ({
          value: status,
          label: t(`status.project.${status}`, { defaultValue: STATUS_LABELS[status] }),
        })),
        value: statusFilter,
        onChange: (value: string[]) => {
          setStatusFilter(value);
          setPage(1);
        },
      },
      {
        key: 'phase',
        label: t('projects.phase', { defaultValue: 'Phase' }),
        options: (query.data?.phases ?? []).map(phase => ({ value: phase, label: decodeHtmlEntities(phase) })),
        value: phaseFilter,
        onChange: (value: string[]) => {
          setPhaseFilter(value);
          setPage(1);
        },
      },
    ],
    [t, statusFilter, phaseFilter, query.data?.phases]
  );

  const clearFilters = () => {
    setStatusFilter([]);
    setPhaseFilter([]);
    resetPage();
  };

  const isEmpty = query.isSuccess && total === 0 && !isFiltered;

  return (
    <div>
      <PageHeader
        title={t('projects.title', { defaultValue: 'Projects' })}
        subtitle={t('projects.subtitle', { defaultValue: 'The projects your team has shared with you.' })}
      />
      <QueryState {...query} refetch={query.refetch}>
        {isEmpty ? (
          <EmptyState
            title={t('projects.none', { defaultValue: 'No projects are shared with you yet' })}
            description={t('projects.noneHelp', {
              defaultValue: 'Your project contact assigns projects to you. They show up here as soon as they do.',
            })}
          />
        ) : (
          <>
            <ListToolbar
              searchText={searchText}
              onSearch={value => {
                setSearchText(value);
                resetPage();
              }}
              searchPlaceholder={t('projects.searchPlaceholder', { defaultValue: 'Search by project, phase or contact…' })}
              filterGroups={filterGroups}
              onClearFilters={clearFilters}
              fields={fields}
              hiddenFields={columnVisibility.hidden}
              onToggleField={columnVisibility.toggle}
            />
            <Card styles={{ body: { padding: 0 } }}>
              <Table<ClientProjectV2>
                rowKey="id"
                showSorterTooltip={false}
                tableLayout="auto"
                columns={withHeaderMinWidth(columnVisibility.visibleColumns(columns))}
                dataSource={projects}
                loading={query.isFetching}
                pagination={false}
                scroll={{ x: 'max-content', y: TABLE_BODY_HEIGHT }}
                locale={{
                  emptyText: t('projects.noMatches', { defaultValue: 'No projects match your search or filters.' }),
                }}
                onChange={(_pagination, _filters, sorter) => {
                  sorting.applySorter(sorter);
                  resetPage();
                }}
                onRow={project => clickableRow(() => openProject(project.id))}
              />
              <TablePagination
                page={page}
                pageSize={size}
                total={total}
                onPageChange={(nextPage, nextSize) => {
                  setPage(nextPage);
                  setSize(nextSize);
                }}
              />
            </Card>
          </>
        )}
      </QueryState>

      <ProjectModal projectId={openProjectId} tab={openTab} intent={intent} onTabChange={changeTab} onClose={closeProject} />
    </div>
  );
};

export default ProjectsPage;
