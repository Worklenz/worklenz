import React, { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Card,
  Flex,
  Table,
  TableProps,
  Typography,
  theme,
  message,
  Tooltip,
  ExpandAltOutlined,
  PlusOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import TablePagination from '@/components/TablePagination';
import './finance-expenses.css';
import { decodeHtmlEntities } from '@/utils/html-entities';
import Avatars from '@/components/avatars/avatars';
import {
  financeOverviewApiService,
  ITeamFixedCostItem,
} from '@/api/finance-overview/finance-overview.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { TASK_FIXED_COST_CHANGED_EVENT } from '@/shared/constants';
import AddExpenseModal from '@/components/expenses/AddExpenseModal';
import { useIsAdminSurfaceReadOnly } from '@/hooks/useIsAdminSurfaceReadOnly';
import { useTaskNameRealtimeSync } from '@/hooks/useTaskNameRealtimeSync';

const FinanceExpensesPage: React.FC = () => {
  const { token } = theme.useToken();
  const { t } = useTranslation('home');
  const dispatch = useAppDispatch();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const isReadOnly = useIsAdminSurfaceReadOnly();

  // Lists every task across the active team that currently has a fixed cost
  // set (see financeOverviewApiService.getTeamFixedCosts). Each row is a
  // task's current running total, not a per-submission ledger — tasks.fixed_cost
  // has no history of individual additions.
  const [recentItems, setRecentItems] = useState<ITeamFixedCostItem[]>([]);

  useTaskNameRealtimeSync({
    items: recentItems,
    setItems: setRecentItems,
  });
  const [recentTotal, setRecentTotal] = useState(0);
  const [recentLoading, setRecentLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchRecentExpenses = (pageNum: number, size: number) => {
    setRecentLoading(true);
    financeOverviewApiService
      .getTeamFixedCosts(pageNum, size)
      .then(res => {
        if (res.done) {
          setRecentItems(res.body.items);
          setRecentTotal(res.body.total);
        }
      })
      .catch(() => {
        setRecentItems([]);
        setRecentTotal(0);
        message.error(t('expenses.loadError'));
      })
      .finally(() => setRecentLoading(false));
  };

  useEffect(() => {
    fetchRecentExpenses(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time refresh — there's no backend socket event for fixed-cost
  // changes, so the Quick Action "Add Expense" modal and the Project Finance
  // table's inline fixed-cost editor both broadcast this CustomEvent after a
  // successful update (same document-CustomEvent pattern used for task
  // comments). Jump back to page 1 so the just-added/changed row is visible,
  // matching the old form's post-submit behavior.
  useEffect(() => {
    const handleFixedCostChanged = () => {
      setPage(1);
      fetchRecentExpenses(1, pageSize);
    };
    document.addEventListener(TASK_FIXED_COST_CHANGED_EVENT, handleFixedCostChanged);
    return () => {
      document.removeEventListener(TASK_FIXED_COST_CHANGED_EVENT, handleFixedCostChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // Matches the fixed-2-decimal, no-thousands-separator format used for
  // currency columns in the Project Finance tables (FinanceTable.tsx).
  const formatAmount = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '0.00';
    return value.toFixed(2);
  };

  const totalPages = Math.max(1, Math.ceil(recentTotal / pageSize));

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    fetchRecentExpenses(nextPage, pageSize);
  };

  const handleTaskClick = useCallback(
    (taskId: string, projectId: string) => {
      dispatch(setProjectId(projectId || ''));
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTask({ taskId, projectId }));
    },
    [dispatch]
  );

  // Mirrors the Home > Overview "Priority" table (TasksList.tsx): plain task
  // name text (not a link) with a hover-only expand icon that opens the task
  // drawer, same font scale, and the same row/column layout conventions.
  const columns: TableProps<ITeamFixedCostItem>['columns'] = [
    {
      key: 'project',
      title: t('expenses.columnProject'),
      width: '20%',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: record.project_color,
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
          <Typography.Text style={{ fontWeight: 500 }} ellipsis>
            {decodeHtmlEntities(record.project_name)}
          </Typography.Text>
        </div>
      ),
    },
    {
      key: 'task',
      title: t('expenses.columnTask'),
      width: '26%',
      render: (_, record) => (
        <div
          onClick={() => handleTaskClick(record.task_id, record.project_id)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <Typography.Text ellipsis style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            {decodeHtmlEntities(record.task_name)}
          </Typography.Text>
          <div className="expense-row-action">
            <Tooltip title={t('expenses.openTask')} placement="right">
              <ExpandAltOutlined style={{ fontSize: 16, color: token.colorTextSecondary }} />
            </Tooltip>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      title: t('expenses.columnAmount'),
      width: '16%',
      onHeaderCell: () => ({ style: { textAlign: 'left', paddingRight: 32 } }),
      onCell: () => ({ style: { textAlign: 'right', paddingRight: 32 } }),
      render: (_, record) => (
        <span style={{ fontWeight: 600 }}>
          {formatAmount(record.fixed_cost)} {record.currency?.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'assignee',
      title: t('expenses.columnAssignee'),
      width: '20%',
      render: (_, record) => <Avatars members={record.assignees || []} maxCount={3} />,
    },
    {
      key: 'date',
      title: t('expenses.columnDate'),
      width: '18%',
      render: (_, record) => dayjs(record.updated_at).format('MMM DD'),
    },
  ];



  return (
    <Flex vertical gap={16}>
      {/* Page Header */}
      <Flex align="center" justify="space-between">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t('expenses.pageTitle')}
          </Typography.Title>

          <Typography.Text
            type="secondary"
            style={{
              fontSize: 13,
              marginTop: 2,
              display: 'block',
            }}
          >
            {t('expenses.pageSubtitle')}
          </Typography.Text>
        </div>

        {!isReadOnly && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsAddExpenseOpen(true)}
          >
            {t('expenses.addExpense', 'Add Expense')}
          </Button>
        )}
      </Flex>

      {/* Existing Add Expense Modal */}
      <AddExpenseModal
        open={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSuccess={() => {
          setIsAddExpenseOpen(false);
          setPage(1);
          fetchRecentExpenses(1, pageSize);
        }}
      />

      {/* Main Expenses Table */}
      <Card
        className="finance-expenses-card"
        style={{
          width: '100%',
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
        styles={{ body: { padding: 20 } }}
      >
        <Table
          dataSource={recentItems}
          columns={columns}
          rowKey={record => record.task_id}
          size="middle"
          loading={recentLoading}
          pagination={false}
          tableLayout="fixed"
          scroll={{ x: 760 }}
          locale={{
            emptyText: (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  textAlign: 'center',
                  padding: '32px 0',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {t('expenses.emptyTitle')}
                </div>
                <p style={{ opacity: 0.6, fontSize: 12, margin: 0, maxWidth: 320 }}>
                  {t('expenses.emptySubtitle')}
                </p>
              </div>
            ),
          }}
        />

        <TablePagination
          navigationLabel={t('common:paginationNavigation')}
          firstPageLabel={t('common:firstPage')}
          previousPageLabel={t('common:previousPage')}
          nextPageLabel={t('common:nextPage')}
          lastPageLabel={t('common:lastPage')}
          renderDefaultSummary={(range, total) => t('common:paginationSummary', { range, total })}
          page={page}
          pageSize={pageSize}
          total={recentTotal}
          onPageChange={(nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
            fetchRecentExpenses(nextPage, nextPageSize);
          }}
          rowsPerPageLabel={t('expenses.rowsPerPage', {
            defaultValue: 'Rows per page',
          })}
          variant="dropdown"
        />
      </Card>
    </Flex>
  );
};

export default FinanceExpensesPage;