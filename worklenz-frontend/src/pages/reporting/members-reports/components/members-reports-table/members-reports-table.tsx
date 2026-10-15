import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Button,
  ConfigProvider,
  Dropdown,
  ExpandAltOutlined,
  MoreOutlined,
  Flex,
  Pagination,
  Table,
  TableColumnsType,
  TableProps,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import CustomTableTitle from '@/components/CustomTableTitle';
import TasksProgressCell from './tablesCells/tasksProgressCell/TasksProgressCell';
import MemberCell from './tablesCells/memberCell/MemberCell';
import {
  fetchMembersData,
  setPagination,
  setSort,
  toggleMembersReportsDrawer,
} from '@/features/reporting/membersReports/membersReportsSlice';
import { useAppSelector } from '@/hooks/useAppSelector';
import MembersReportsDrawer from '@/features/reporting/membersReports/membersReportsDrawer/members-reports-drawer';
import { buildSkeletonRows, toSkeletonColumns } from '@/components/reporting/table-skeleton';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Maps a column key to the field the backend sorts by.
const SORT_FIELD_BY_COLUMN: Record<string, string> = {
  member: 'name',
  email: 'email',
  role: 'role_name',
  projectsAssigned: 'projects',
  teamsCount: 'teams_count',
  tasksAssigned: 'tasks',
  overdueTasks: 'overdue',
  completedTasks: 'completed',
  ongoingTasks: 'ongoing',
};

interface MembersReportsTableProps {
  hiddenColumns?: string[];
}

export const MEMBERS_TOGGLEABLE_COLUMNS = [
  { key: 'email', labelKey: 'emailColumn', defaultLabel: 'Email' },
  { key: 'role', labelKey: 'roleColumn', defaultLabel: 'Member Role' },
  { key: 'projectsAssigned', labelKey: 'projectsAssignedColumn', defaultLabel: 'Projects' },
  { key: 'teamsCount', labelKey: 'teamsColumn', defaultLabel: 'Teams' },
  { key: 'tasksProgress', labelKey: 'tasksProgressColumn', defaultLabel: 'Tasks Progress' },
  { key: 'tasksAssigned', labelKey: 'tasksAssignedColumn', defaultLabel: 'Tasks Assigned' },
  { key: 'overdueTasks', labelKey: 'overdueTasksColumn', defaultLabel: 'Overdue Tasks' },
  { key: 'completedTasks', labelKey: 'completedTasksColumn', defaultLabel: 'Completed Tasks' },
  { key: 'ongoingTasks', labelKey: 'ongoingTasksColumn', defaultLabel: 'Ongoing Tasks' },
];

const MembersReportsTable = ({ hiddenColumns = [] }: MembersReportsTableProps) => {
  const { t } = useTranslation('reporting-members');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);
  const { membersList, isLoading, total, archived, teams, searchQuery, index, pageSize, field, order } =
    useAppSelector(state => state.membersReportsReducer);

  // function to handle drawer toggle
  const handleDrawerOpen = (id: string) => {
    setSelectedId(id);
    dispatch(toggleMembersReportsDrawer());
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState<number>(240);

  // Size the table body to the space left above the pagination footer so the header stays visible.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const header = element.querySelector<HTMLElement>('.ant-table-header')?.offsetHeight ?? 40;
      setScrollY(Math.max(120, element.clientHeight - header - 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [membersList, isLoading]);

  const handlePageChange = (nextPage: number) => {
    dispatch(setPagination({ index: nextPage, pageSize }));
  };

  const handlePageSizeChange = (nextSize: number) => {
    dispatch(setPagination({ index: 1, pageSize: nextSize }));
  };

  const rangeStart = total === 0 ? 0 : (index - 1) * pageSize + 1;
  const rangeEnd = Math.min(index * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const baseColumns: TableColumnsType = [
    {
      key: 'member',
      title: <CustomTableTitle title={t('memberColumn')} />,
      render: record => (
        <button
          type="button"
          className="group flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
          onClick={() => handleDrawerOpen(record.id)}
        >
          <MemberCell member={record} />
          <ExpandAltOutlined
            aria-hidden
            className="ml-auto opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            style={{ fontSize: 12, color: token.colorTextSecondary }}
          />
        </button>
      ),
    },
    {
      key: 'email',
      title: <CustomTableTitle title={t('emailColumn', { defaultValue: 'Email' })} />,
      dataIndex: 'email',
      render: (email?: string) => email || '-',
    },
    {
      key: 'role',
      title: <CustomTableTitle title={t('roleColumn', { defaultValue: 'Member Role' })} />,
      dataIndex: 'role_name',
      render: (role?: string) => role || '-',
    },
    {
      key: 'projectsAssigned',
      title: (
        <CustomTableTitle
          title={t('projectsAssignedColumn', { defaultValue: 'Projects' })}
          tooltip={t('projectsAssignedColumnTooltip', {
            defaultValue: 'Number of projects the member is assigned to',
          })}
        />
      ),
      className: 'text-center',
      dataIndex: 'projects',
      width: 140,
    },
    {
      key: 'teamsCount',
      title: (
        <CustomTableTitle
          title={t('teamsColumn', { defaultValue: 'Teams' })}
          tooltip={t('teamsColumnTooltip', {
            defaultValue: 'Number of teams the member belongs to',
          })}
        />
      ),
      className: 'text-center',
      dataIndex: 'teams_count',
      width: 120,
    },
    {
      key: 'tasksProgress',
      title: <CustomTableTitle title={t('tasksProgressColumn')} />,
      render: record => {
        const { todo, doing, done } = record.tasks_stat;
        return todo || doing || done ? <TasksProgressCell tasksStat={record.tasks_stat} /> : '-';
      },
    },
    {
      key: 'tasksAssigned',
      title: (
        <CustomTableTitle
          title={t('tasksAssignedColumn')}
          tooltip={t('tasksAssignedColumnTooltip')}
        />
      ),
      className: 'text-center',
      dataIndex: 'tasks',
      width: 180,
    },
    {
      key: 'overdueTasks',
      title: (
        <CustomTableTitle
          title={t('overdueTasksColumn')}
          tooltip={t('overdueTasksColumnTooltip')}
        />
      ),
      className: 'text-center',
      dataIndex: 'overdue',
      width: 180,
    },
    {
      key: 'completedTasks',
      title: (
        <CustomTableTitle
          title={t('completedTasksColumn')}
          tooltip={t('completedTasksColumnTooltip')}
        />
      ),
      className: 'text-center',
      dataIndex: 'completed',
      width: 180,
    },
    {
      key: 'ongoingTasks',
      title: (
        <CustomTableTitle
          title={t('ongoingTasksColumn')}
          tooltip={t('ongoingTasksColumnTooltip')}
        />
      ),
      className: 'text-center',
      dataIndex: 'ongoing',
      width: 180,
    },
    {
      key: 'actions',
      title: '',
      width: 56,
      fixed: 'right',
      align: 'center',
      render: record => (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'view',
                label: t('viewDetails', { defaultValue: 'View details' }),
                onClick: () => handleDrawerOpen(record.id),
              },
            ],
          }}
        >
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            aria-label={t('rowActions', { defaultValue: 'Row actions' })}
          />
        </Dropdown>
      ),
    },
  ];

  const columns: TableColumnsType = baseColumns
    .filter(column => !hiddenColumns.includes(String(column.key)))
    .map(column => {
      const sortField = SORT_FIELD_BY_COLUMN[String(column.key)];
      if (!sortField) return column;
      return {
        ...column,
        sorter: true,
        sortOrder: field === sortField ? (order === 'desc' ? 'descend' : 'ascend') : null,
      };
    });

  const handleTableChange: TableProps['onChange'] = (_pagination, _filters, sorter) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const nextField = activeSorter?.order
      ? SORT_FIELD_BY_COLUMN[String(activeSorter.columnKey)]
      : undefined;
    dispatch(
      setSort({
        field: nextField ?? '',
        order: nextField ? (activeSorter.order === 'descend' ? 'desc' : 'asc') : '',
      })
    );
  };

  useEffect(() => {
    if (!isLoading) dispatch(fetchMembersData({ duration, dateRange }));
  }, [dispatch, archived, teams, field, order, searchQuery, dateRange, index, pageSize]);

  // The first load has no rows yet, so draw placeholder rows instead of an empty table.
  const showSkeleton = isLoading && membersList.length === 0;

  return (
    <ConfigProvider
      theme={{
        components: {
          Table: {
            cellPaddingBlock: 8,
            cellPaddingInline: 10,
          },
        },
      }}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
        style={{ borderColor: token.colorBorderSecondary, background: token.colorBgContainer }}
      >
        <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden">
          <Table
            size="middle"
            showSorterTooltip={false}
            columns={showSkeleton ? toSkeletonColumns(columns) : columns}
            dataSource={showSkeleton ? buildSkeletonRows<{ id: string }>(pageSize) : membersList}
            rowKey={record => record.id}
            pagination={false}
            onChange={handleTableChange}
            scroll={{ x: 'max-content', y: scrollY }}
            loading={isLoading && !showSkeleton}
          />
        </div>
        <Flex
          align="center"
          justify="space-between"
          gap={12}
          wrap="wrap"
          className="px-4 py-3"
          style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
        >
          <Flex align="center" gap={8}>
            <label htmlFor="members-reports-page-size" className="text-xs">
              {t('rowsPerPage', { defaultValue: 'Rows per page:' })}
            </label>
            <select
              id="members-reports-page-size"
              value={pageSize}
              onChange={event => handlePageSizeChange(Number(event.target.value))}
              className="rounded-md border px-2 py-1 text-xs"
              style={{
                background: token.colorBgContainer,
                color: token.colorText,
                borderColor: token.colorBorder,
              }}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-xs" style={{ color: token.colorTextSecondary }}>
              {t('rangeOfTotal', {
                start: rangeStart,
                end: rangeEnd,
                total,
                defaultValue: '{{start}}-{{end}} of {{total}}',
              })}
            </span>
          </Flex>
          <Flex align="center" gap={8}>
            <Button
              size="small"
              aria-label={t('firstPage', { defaultValue: 'First page' })}
              disabled={index <= 1}
              onClick={() => handlePageChange(1)}
            >
              «
            </Button>
            <Pagination
              current={index}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              onChange={handlePageChange}
            />
            <Button
              size="small"
              aria-label={t('lastPage', { defaultValue: 'Last page' })}
              disabled={index >= lastPage}
              onClick={() => handlePageChange(lastPage)}
            >
              »
            </Button>
          </Flex>
        </Flex>
      </div>

      <MembersReportsDrawer memberId={selectedId} />
    </ConfigProvider>
  );
};

export default MembersReportsTable;
