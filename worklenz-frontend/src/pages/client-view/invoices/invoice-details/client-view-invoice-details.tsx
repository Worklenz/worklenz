import { Card, Descriptions, Flex, Typography, Button, Tag, Divider } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { durationDateFormat } from '../../../../utils/durationDateFormat';
import { DownloadOutlined, PrinterOutlined, DollarOutlined } from '@ant-design/icons';

const ClientViewInvoiceDetails = () => {
  const { t } = useTranslation('client-view-invoices');
  const { id } = useParams();
  const navigate = useNavigate();

  // Get invoice details from Redux (replace with API call)
  const invoiceDetails = useAppSelector(state =>
    state.clientViewReducer.invoicesReducer?.invoices?.find((invoice: any) => invoice.id === id)
  );

  if (!invoiceDetails) {
    return (
      <Flex vertical gap={24} style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ marginBlock: 0 }}>
          {t('invoiceNotFound')}
        </Typography.Title>
        <Button onClick={() => navigate('/client-portal/invoices')}>{t('backToInvoices')}</Button>
      </Flex>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'default';
      case 'sent':
        return 'processing';
      case 'paid':
        return 'success';
      case 'overdue':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between">
        <Typography.Title level={4} style={{ marginBlock: 0 }}>
          {t('invoiceDetails')} - {invoiceDetails.invoice_no || 'INV-001'}
        </Typography.Title>
        <Flex gap={8}>
          <Button icon={<DownloadOutlined />}>{t('download')}</Button>
          <Button icon={<PrinterOutlined />}>{t('print')}</Button>
          <Button onClick={() => navigate('/client-portal/invoices')}>{t('backToInvoices')}</Button>
        </Flex>
      </Flex>

      <Card>
        <Descriptions title={t('invoiceInformation')} bordered>
          <Descriptions.Item label={t('invoiceNumber')} span={2}>
            {invoiceDetails.invoice_no || 'INV-001'}
          </Descriptions.Item>
          <Descriptions.Item label={t('status')} span={1}>
            <Tag color={getStatusColor(invoiceDetails.status)}>{t(invoiceDetails.status)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('amount')} span={1}>
            <Typography.Text strong style={{ fontSize: 16 }}>
              {formatCurrency(invoiceDetails.amount || 0, invoiceDetails.currency)}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('currency')} span={1}>
            {invoiceDetails.currency || 'USD'}
          </Descriptions.Item>
          <Descriptions.Item label={t('dueDate')} span={1}>
            {invoiceDetails.due_date ? durationDateFormat(invoiceDetails.due_date) : t('notSet')}
          </Descriptions.Item>
          <Descriptions.Item label={t('createdOn')} span={3}>
            {durationDateFormat(invoiceDetails.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label={t('sentOn')} span={3}>
            {invoiceDetails.sent_at ? durationDateFormat(invoiceDetails.sent_at) : t('notSent')}
          </Descriptions.Item>
          <Descriptions.Item label={t('paidOn')} span={3}>
            {invoiceDetails.paid_at ? durationDateFormat(invoiceDetails.paid_at) : t('notPaid')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={t('invoiceItems')}>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Typography.Text type="secondary">{t('noItems')}</Typography.Text>
        </div>
      </Card>

      <Card title={t('paymentInformation')}>
        <Flex vertical gap={16}>
          <Flex align="center" justify="space-between">
            <Typography.Text>{t('subtotal')}:</Typography.Text>
            <Typography.Text>
              {formatCurrency(invoiceDetails.amount || 0, invoiceDetails.currency)}
            </Typography.Text>
          </Flex>
          <Flex align="center" justify="space-between">
            <Typography.Text>{t('tax')}:</Typography.Text>
            <Typography.Text>{formatCurrency(0, invoiceDetails.currency)}</Typography.Text>
          </Flex>
          <Divider />
          <Flex align="center" justify="space-between">
            <Typography.Text strong>{t('total')}:</Typography.Text>
            <Typography.Text strong style={{ fontSize: 16 }}>
              {formatCurrency(invoiceDetails.amount || 0, invoiceDetails.currency)}
            </Typography.Text>
          </Flex>
        </Flex>
      </Card>

      {invoiceDetails.status === 'sent' && (
        <Card title={t('paymentOptions')}>
          <Flex vertical gap={12}>
            <Button type="primary" size="large" icon={<DollarOutlined />}>
              {t('payNow')}
            </Button>
            <Typography.Text type="secondary">{t('paymentInstructions')}</Typography.Text>
          </Flex>
        </Card>
      )}

      <Card title={t('notes')}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Typography.Text type="secondary">{t('noNotes')}</Typography.Text>
        </div>
      </Card>
    </Flex>
  );
};

export default ClientViewInvoiceDetails;
