import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Table,
  Tag,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import {
  financeOverviewApiService,
  IFinanceInvoiceRow,
} from '@/api/finance-overview/finance-overview.api.service';
import { FinanceKpiCard } from './FinanceKpiCard';
import { fmtMoney } from './finance-report-utils';
import { useFinanceReportFetch } from './useFinanceReportFetch';

const { Text, Title } = Typography;

const paymentTagColor = (status: string): string => {
  if (status === 'paid') return 'success';
  if (status === 'overdue') return 'error';
  if (status === 'draft' || status === 'cancelled') return 'default';
  return 'warning';
};

export const FinanceInvoicesPage = () => {
  const { t } = useTranslation('finance-reports');
  const navigate = useNavigate();
  useDocumentTitle(t('invoices.pageTitle', { defaultValue: 'Invoices' }));

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, loading, error, refetch } = useFinanceReportFetch(
    () => financeOverviewApiService.getInvoices({ page, page_size: pageSize }),
    [page, pageSize]
  );

  const rows: IFinanceInvoiceRow[] = data?.invoices ?? [];
  const total = data?.total ?? 0;
  const summary = data?.summary ?? {
    total_invoiced: 0,
    total_paid: 0,
    total_outstanding: 0,
  };

  const columns: ColumnsType<IFinanceInvoiceRow> = useMemo(
    () => [
      {
        title: t('invoices.table.invoice', { defaultValue: 'Invoice' }),
        dataIndex: 'invoice_no',
        key: 'invoice_no',
        render: (value: string, record) => (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            aria-label={t('invoices.openInvoice', { defaultValue: 'Open invoice' })}
            onClick={() => navigate(`/worklenz/client-portal/invoices/${record.id}`)}
          >
            {value}
          </Button>
        ),
      },
      {
        title: t('invoices.table.client', { defaultValue: 'Client' }),
        dataIndex: 'client_name',
        key: 'client_name',
        render: (value: string | null) => value || t('emptyValue', { defaultValue: '—' }),
      },
      {
        title: t('invoices.table.project', { defaultValue: 'Project' }),
        dataIndex: 'project_name',
        key: 'project_name',
        render: (value: string | null, record) =>
          value ? (
            <Flex align="center" gap={6}>
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
              <Tooltip title={value}>
                <Text ellipsis style={{ maxWidth: 160 }}>
                  {value}
                </Text>
              </Tooltip>
            </Flex>
          ) : (
            <Text type="secondary">{t('emptyValue', { defaultValue: '—' })}</Text>
          ),
      },
      {
        title: t('invoices.table.amount', { defaultValue: 'Amount' }),
        dataIndex: 'amount',
        key: 'amount',
        render: (value: number, record) => <Text strong>{fmtMoney(value, record.currency)}</Text>,
      },
      {
        title: t('invoices.table.paymentStatus', { defaultValue: 'Payment Status' }),
        dataIndex: 'payment_status',
        key: 'payment_status',
        render: (status: string) => (
          <Tag color={paymentTagColor(status)}>
            {t(`invoices.status.${status}`, { defaultValue: status })}
          </Tag>
        ),
      },
      {
        title: t('invoices.table.paidAmount', { defaultValue: 'Paid Amount' }),
        dataIndex: 'paid_amount',
        key: 'paid_amount',
        render: (value: number, record) =>
          value > 0 ? (
            <Text strong style={{ color: '#52c41a' }}>
              {fmtMoney(value, record.currency)}
            </Text>
          ) : (
            <Text type="secondary">{t('emptyValue', { defaultValue: '—' })}</Text>
          ),
      },
      {
        title: t('invoices.table.status', { defaultValue: 'Status' }),
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => (
          <Tag>{t(`invoices.status.${status}`, { defaultValue: status })}</Tag>
        ),
      },
      {
        title: t('invoices.table.issued', { defaultValue: 'Issued' }),
        dataIndex: 'issued_at',
        key: 'issued_at',
        render: (value: string) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(value).format('MMM D, YYYY')}
          </Text>
        ),
      },
      {
        title: t('invoices.table.due', { defaultValue: 'Due' }),
        dataIndex: 'due_date',
        key: 'due_date',
        render: (value: string | null, record) =>
          value ? (
            <Text
              style={{
                fontSize: 12,
                color: record.payment_status === 'overdue' ? '#ff4d4f' : undefined,
              }}
            >
              {dayjs(value).format('MMM D, YYYY')}
            </Text>
          ) : (
            <Text type="secondary">{t('emptyValue', { defaultValue: '—' })}</Text>
          ),
      },
    ],
    [navigate, t]
  );

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          {t('invoices.pageTitle', { defaultValue: 'Invoices' })}
        </Title>
        <Text type="secondary" style={{ fontSize: 13, marginTop: 2, display: 'block' }}>
          {t('invoices.pageSubTitle', {
            defaultValue: 'Send, track, and collect client payments from one portfolio view.',
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

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <FinanceKpiCard
            title={t('invoices.kpi.totalInvoiced', { defaultValue: 'Total invoiced' })}
            value={fmtMoney(summary.total_invoiced)}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={8}>
          <FinanceKpiCard
            title={t('invoices.kpi.totalPaid', { defaultValue: 'Total paid' })}
            value={fmtMoney(summary.total_paid)}
            valueColor="#52c41a"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={8}>
          <FinanceKpiCard
            title={t('invoices.kpi.totalOutstanding', { defaultValue: 'Total outstanding' })}
            value={fmtMoney(summary.total_outstanding)}
            valueColor="#ff4d4f"
            loading={loading}
          />
        </Col>
      </Row>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<IFinanceInvoiceRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [5, 10, 20, 50],
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
          locale={{
            emptyText: (
              <Empty
                description={t('invoices.empty', {
                  defaultValue: 'No invoices yet. Create invoices from Client Portal.',
                })}
              />
            ),
          }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </Flex>
  );
};

export default FinanceInvoicesPage;
