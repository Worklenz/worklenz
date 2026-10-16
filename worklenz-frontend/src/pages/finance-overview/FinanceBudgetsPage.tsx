import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Progress,
  Table,
  Tag,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import {
  financeOverviewApiService,
  IFinanceBudgetProject,
} from '@/api/finance-overview/finance-overview.api.service';
import { alertColor, burnColor, fmtMoney } from './finance-report-utils';
import { useFinanceReportFetch } from './useFinanceReportFetch';

const { Text, Title } = Typography;

export const FinanceBudgetsPage = () => {
  const { t } = useTranslation('finance-reports');
  useDocumentTitle(t('budgets.pageTitle', { defaultValue: 'Budgets' }));

  const { data, loading, error, refetch } = useFinanceReportFetch(
    () => financeOverviewApiService.getBudgets(),
    []
  );
  const projects: IFinanceBudgetProject[] = data?.projects ?? [];

  const columns: ColumnsType<IFinanceBudgetProject> = useMemo(
    () => [
      {
        title: t('budgets.table.project', { defaultValue: 'Project' }),
        dataIndex: 'name',
        key: 'name',
        render: (name: string, record) => (
          <Flex align="center" gap={8} style={{ minWidth: 0 }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: record.color_code || '#1890ff',
                flexShrink: 0,
              }}
            />
            <Tooltip title={name}>
              <Text ellipsis style={{ maxWidth: 220 }}>
                {name}
              </Text>
            </Tooltip>
          </Flex>
        ),
      },
      {
        title: t('budgets.table.budget', { defaultValue: 'Budget' }),
        dataIndex: 'budget',
        key: 'budget',
        render: (value: number, record) =>
          value > 0 ? (
            fmtMoney(value, record.currency)
          ) : (
            <Text type="secondary">{t('noBudgetSet', { defaultValue: 'No budget set' })}</Text>
          ),
      },
      {
        title: t('budgets.table.spent', { defaultValue: 'Spent' }),
        dataIndex: 'spent',
        key: 'spent',
        render: (value: number, record) => (
          <Text strong style={{ color: record.burn_pct > 85 ? '#ff4d4f' : undefined }}>
            {fmtMoney(value, record.currency)}
          </Text>
        ),
      },
      {
        title: t('budgets.table.remaining', { defaultValue: 'Remaining' }),
        dataIndex: 'remaining',
        key: 'remaining',
        render: (value: number, record) => (
          <Text strong style={{ color: value < 0 ? '#ff4d4f' : '#52c41a' }}>
            {fmtMoney(value, record.currency)}
          </Text>
        ),
      },
      {
        title: t('budgets.table.burnRate', { defaultValue: 'Burn Rate' }),
        key: 'burn',
        width: 180,
        render: (_: unknown, record) =>
          record.budget > 0 ? (
            <Flex align="center" gap={8}>
              <Progress
                percent={Math.min(record.burn_pct, 100)}
                showInfo={false}
                strokeColor={burnColor(record.burn_pct)}
                size="small"
                style={{ flex: 1, margin: 0 }}
              />
              <Text style={{ fontSize: 12, minWidth: 36 }}>{record.burn_pct}%</Text>
            </Flex>
          ) : (
            <Text type="secondary">{t('emptyValue', { defaultValue: '—' })}</Text>
          ),
      },
      {
        title: t('budgets.table.etc', { defaultValue: 'ETC' }),
        dataIndex: 'etc',
        key: 'etc',
        render: (value: number, record) => (
          <Text type="secondary">{fmtMoney(value, record.currency)}</Text>
        ),
      },
      {
        title: t('budgets.table.alert', { defaultValue: 'Alert' }),
        dataIndex: 'alert',
        key: 'alert',
        render: (alert: IFinanceBudgetProject['alert']) => (
          <Tag color={alertColor(alert)}>
            {t(`budgets.alert.${alert}`, { defaultValue: alert })}
          </Tag>
        ),
      },
    ],
    [t]
  );

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          {t('budgets.pageTitle', { defaultValue: 'Budgets' })}
        </Title>
        <Text type="secondary" style={{ fontSize: 13, marginTop: 2, display: 'block' }}>
          {t('budgets.pageSubTitle', {
            defaultValue: 'Budget tracking and burn rate across all projects.',
          })}
        </Text>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message={t('loadError', { defaultValue: 'Could not load this report. Try again.' })}
          action={
            <Button size="small" onClick={refetch}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<IFinanceBudgetProject>
          rowKey="id"
          columns={columns}
          dataSource={projects}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
          locale={{
            emptyText: (
              <Empty description={t('budgets.empty', { defaultValue: 'No projects to show yet.' })} />
            ),
          }}
          scroll={{ x: 900 }}
        />
      </Card>
    </Flex>
  );
};

export default FinanceBudgetsPage;
