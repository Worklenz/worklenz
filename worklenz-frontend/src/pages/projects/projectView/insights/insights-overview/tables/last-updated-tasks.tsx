import { Flex, Table, Tooltip, Typography } from '@/shared/antd-imports';
import { useCallback, useEffect, useRef, useState } from 'react';
import { colors } from '@/styles/colors';
import { TableProps } from 'antd/lib';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IInsightTasks } from '@/types/project/projectInsights.types';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import logger from '@/utils/errorLogger';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAdaptivePageSize } from './use-adaptive-page-size';

const LastUpdatedTasks = () => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);
  const { t } = useTranslation('project-view-insights');
  const { socket } = useSocket();

  const [data, setData] = useState<IInsightTasks[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageSizeOverride, setPageSizeOverride] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);

  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const { pageSize: adaptivePageSize, isReady: isPageSizeReady } =
    useAdaptivePageSize(tableWrapperRef);
  const pageSize = pageSizeOverride ?? adaptivePageSize;

  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;
  const requestIdRef = useRef(0);

  const getLastUpdatedTasks = useCallback(async (page = 1, limit = 20) => {
    if (!projectId) return;
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const res = await projectInsightsApiService.getLastUpdatedTasks(
        projectId,
        includeArchivedTasks,
        limit,
        offset
      );
      if (currentRequestId !== requestIdRef.current) return;
      if (res.done && res.body) {
        if (Array.isArray(res.body)) {
          setData(res.body);
          setTotal(res.body.length);
        } else {
          setData(res.body.tasks || []);
          setTotal(res.body.total || 0);
        }
      }
    } catch (error) {
      if (currentRequestId === requestIdRef.current) {
        logger.error('getLastUpdatedTasks', error);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [projectId, includeArchivedTasks]);

  const handlePageChange = (page: number, size: number) => {
    if (size !== pageSizeRef.current) {
      // The user picked a row count; the effect below refetches page 1 with it.
      setPageSizeOverride(size);
      return;
    }

    setCurrentPage(page);
    currentPageRef.current = page;
    getLastUpdatedTasks(page, size);
  };

  useEffect(() => {
    if (!isPageSizeReady) return;
    setCurrentPage(1);
    currentPageRef.current = 1;
    getLastUpdatedTasks(1, pageSize);
  }, [
    projectId,
    includeArchivedTasks,
    refreshTimestamp,
    pageSize,
    isPageSizeReady,
    getLastUpdatedTasks,
  ]);

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      getLastUpdatedTasks(currentPageRef.current, pageSizeRef.current);
    };

    socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), handleUpdate);
    socket.on(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleUpdate);
    socket.on(SocketEvents.PROJECT_STATUS_CHANGE.toString(), handleUpdate);

    return () => {
      socket.off(SocketEvents.TASK_STATUS_CHANGE.toString(), handleUpdate);
      socket.off(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleUpdate);
      socket.off(SocketEvents.PROJECT_STATUS_CHANGE.toString(), handleUpdate);
    };
  }, [socket, getLastUpdatedTasks]);

  // table columns
  // const columns: TableProps['columns'] = [
  //   {
  //     key: 'name',
  //     title: 'Name',
  //     render: (record: IInsightTasks) => <Typography.Text>{record.name}</Typography.Text>,
  //   },
  //   {
  //     key: 'status',
  //     title: 'Status',
  //     render: (record: IInsightTasks) => (
  //       <Flex
  //         gap={4}
  //         style={{
  //           width: 'fit-content',
  //           borderRadius: 24,
  //           paddingInline: 6,
  //           backgroundColor: record.status_color,
  //           color: colors.darkGray,
  //           cursor: 'pointer',
  //         }}
  //       >
  //         <Typography.Text
  //           ellipsis={{ expanded: false }}
  //           style={{
  //             color: colors.darkGray,
  //             fontSize: 13,
  //           }}
  //         >
  //           {record.status}
  //         </Typography.Text>
  //       </Flex>
  //     ),
  //   },
  //   {
  //     key: 'dueDate',
  //     title: 'Due Date',
  //     render: (record: IInsightTasks) => (
  //       <Typography.Text>
  //         {record.end_date ? simpleDateFormat(record.end_date) : 'N/A'}
  //       </Typography.Text>
  //     ),
  //   },
  //   {
  //     key: 'lastUpdated',
  //     title: 'Last Updated',
  //     render: (record: IInsightTasks) => (
  //       <Tooltip title={record.updated_at ? formatDateTimeWithLocale(record.updated_at) : 'N/A'}>
  //         <Typography.Text>
  //           {record.updated_at ? calculateTimeDifference(record.updated_at) : 'N/A'}
  //         </Typography.Text>
  //       </Tooltip>
  //     ),
  //   },
  // ];

  //change 4
  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: t('common.name', { defaultValue: 'Name' }),
      dataIndex: 'name',
      render: (_: any, record: IInsightTasks) => <Typography.Text>{record.name}</Typography.Text>,
    },
    {
      key: 'status',
      title: t('common.status', { defaultValue: 'Status' }),
      dataIndex: 'status',
      render: (_: any, record: IInsightTasks) => (
        <Flex
          gap={4}
          style={{
            width: 'fit-content',
            borderRadius: 24,
            paddingInline: 6,
            backgroundColor: record.status_color,
            color: colors.darkGray,
            cursor: 'pointer',
          }}
        >
          <Typography.Text
            ellipsis={{ expanded: false }}
            style={{
              color: colors.darkGray,
              fontSize: 13,
            }}
          >
            {record.status_name || record.status}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'dueDate',
      title: t('common.dueDate', { defaultValue: 'Due Date' }),
      dataIndex: 'end_date',
      render: (_: any, record: IInsightTasks) => (
        <Typography.Text>
          {record.end_date ? simpleDateFormat(record.end_date) : t('common.na', { defaultValue: 'N/A' })}
        </Typography.Text>
      ),
    },
    {
      key: 'lastUpdated',
      title: t('common.lastUpdated', { defaultValue: 'Last Updated' }),
      dataIndex: 'updated_at',
      render: (_: any, record: IInsightTasks) => (
        <Tooltip title={record.updated_at ? formatDateTimeWithLocale(record.updated_at) : t('common.na', { defaultValue: 'N/A' })}>
          <Typography.Text>
            {record.updated_at
              ? calculateTimeDifference(record.updated_at, t('justNow', { defaultValue: 'Just now' }))
              : t('common.na', { defaultValue: 'N/A' })}
          </Typography.Text>
        </Tooltip>
      ),
    },
  ];

  const dataSource = data.map(record => ({
    ...record,
    key: record.id,
  }));

  return (
    <div ref={tableWrapperRef}>
      <Table
        className="custom-two-colors-row-table insights-overview-table"
        dataSource={dataSource}
        columns={columns}
        rowKey={record => record.id}
        pagination={{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showTotal: (totalCount, range) =>
            t('common.paginationRange', {
              from: range[0],
              to: range[1],
              total: totalCount,
              defaultValue: '{{from}}–{{to}} of {{total}}',
            }),
          onChange: handlePageChange,
        }}
        loading={loading}
        onRow={() => {
          return {
            style: {
              cursor: 'pointer',
            },
          };
        }}
      />
    </div>
  );
};

export default LastUpdatedTasks;
