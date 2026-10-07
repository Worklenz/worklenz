import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  Card,
  Typography,
  Button,
  Descriptions,
  Flex,
  Row,
  Col,
  Tag,
  Spin,
  Result,
  Space,
  Divider,
  Statistic,
  Avatar,
  Tooltip,
  Modal,
  message,
  Image,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  UserOutlined,
  CalendarOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { FileImageOutlined, FilePdfOutlined } from '@ant-design/icons';
import {
  useGetInvoiceDetailsQuery,
  useSendInvoiceMutation,
  useMarkInvoiceAsPaidMutation,
  useDeleteInvoiceMutation,
} from '@/api/client-portal/client-portal-api';
import InvoicePreviewModal from './invoice-preview-modal';
import config from '@/config/env';
import { API_BASE_URL } from '@/shared/constants';

const { Title, Text } = Typography;

const getInvoiceDownloadUrl = (invoiceId: string) =>
  `${config.apiUrl.replace(/\/$/, '')}${API_BASE_URL}/clients/portal/invoices/${invoiceId}/download`;

const ClientPortalInvoiceDetails: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('client-portal-invoices');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [paymentProofPreviewOpen, setPaymentProofPreviewOpen] = useState(false);

  // Mutations
  const [sendInvoice, { isLoading: isSending }] = useSendInvoiceMutation();
  const [markAsPaid, { isLoading: isMarkingPaid }] = useMarkInvoiceAsPaidMutation();
  const [deleteInvoice, { isLoading: isDeleting }] = useDeleteInvoiceMutation();

  const { data, isLoading, error } = useGetInvoiceDetailsQuery(invoiceId as string, {
    skip: !invoiceId,
  });

  // Get status tag color and icon
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'paid':
        return { color: 'success', icon: <CheckCircleOutlined /> };
      case 'sent':
        return { color: 'processing', icon: <SendOutlined /> };
      case 'draft':
        return { color: 'default', icon: <FileTextOutlined /> };
      case 'overdue':
        return { color: 'error', icon: <ExclamationCircleOutlined /> };
      case 'cancelled':
        return { color: 'default', icon: <ClockCircleOutlined /> };
      default:
        return { color: 'default', icon: <FileTextOutlined /> };
    }
  };

  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return t('statusPaid', { defaultValue: 'Paid' });
      case 'sent':
        return t('statusSent', { defaultValue: 'Sent' });
      case 'draft':
        return t('statusDraft', { defaultValue: 'Draft' });
      case 'overdue':
        return t('statusOverdue', { defaultValue: 'Overdue' });
      case 'cancelled':
        return t('statusCancelled', { defaultValue: 'Cancelled' });
      default:
        return status;
    }
  };

  // Format date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Handle send invoice
  const handleSendInvoice = async () => {
    try {
      await sendInvoice(invoiceId!).unwrap();
      message.success(
        t('sendInvoice', { defaultValue: 'Send Invoice' }) +
          ' ' +
          t('createInvoiceSuccessMessage', { defaultValue: 'Invoice sent successfully' })
      );
    } catch (error) {
      message.error(t('createInvoiceErrorMessage', { defaultValue: 'Failed to send invoice' }));
    }
  };

  // Handle mark as paid
  const handleMarkAsPaid = async () => {
    Modal.confirm({
      title: t('markAsPaid.title', { defaultValue: 'Mark as Paid' }),
      content: t('markAsPaid.confirm', {
        defaultValue: 'Are you sure you want to mark this invoice as paid?',
      }),
      okText: t('markAsPaid.okText', { defaultValue: 'Mark as Paid' }),
      cancelText: t('markAsPaid.cancelText', { defaultValue: 'Cancel' }),
      onOk: async () => {
        try {
          await markAsPaid(invoiceId!).unwrap();
          message.success(
            t('markAsPaid.success', { defaultValue: 'Invoice marked as paid successfully' })
          );
        } catch (error) {
          message.error(
            t('markAsPaid.failure', { defaultValue: 'Failed to mark invoice as paid' })
          );
        }
      },
    });
  };

  // Handle edit invoice
  const handleEditInvoice = () => {
    if (!invoiceId) return;
    navigate(`/worklenz/client-portal/invoices/${invoiceId}/edit`);
  };

  // Handle delete invoice
  const handleDeleteInvoice = async () => {
    Modal.confirm({
      title: t('deleteInvoice.title', { defaultValue: 'Delete Invoice' }),
      content: t('deleteInvoice.confirm', {
        defaultValue: 'Are you sure you want to delete this invoice? This action cannot be undone.',
      }),
      okText: t('deleteInvoice.okText', { defaultValue: 'Delete' }),
      okType: 'danger',
      cancelText: t('deleteInvoice.cancelText', { defaultValue: 'Cancel' }),
      onOk: async () => {
        try {
          await deleteInvoice(invoiceId!).unwrap();
          message.success(
            t('deleteInvoice.success', { defaultValue: 'Invoice deleted successfully' })
          );
          navigate('/worklenz/client-portal/invoices');
        } catch (error) {
          message.error(t('deleteInvoice.failure', { defaultValue: 'Failed to delete invoice' }));
        }
      },
    });
  };

  // Handle download invoice
  const handleDownloadInvoice = () => {
    if (!invoiceId) return;
    window.open(getInvoiceDownloadUrl(invoiceId), '_blank', 'noopener,noreferrer');
  };

  // Loading state
  if (isLoading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '60vh' }}>
        <Spin size="large" tip={t('loadingInvoice', { defaultValue: 'Loading invoice...' })} />
      </Flex>
    );
  }

  // Error state
  if (error || !data?.done || !data.body) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '60vh' }}>
        <Result
          status="error"
          title={t('errorLoadingInvoice', { defaultValue: 'Error Loading Invoice' })}
          subTitle={t('errorLoadingInvoiceDescription', {
            defaultValue: 'Unable to load invoice details. Please try again.',
          })}
          extra={
            <Button type="primary" onClick={() => navigate(-1)}>
              {t('backToInvoices', { defaultValue: 'Back to Invoices' })}
            </Button>
          }
        />
      </Flex>
    );
  }

  const invoice = data.body;
  const statusConfig = getStatusConfig(invoice.status);

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <Flex align="center" gap={16}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/worklenz/client-portal/invoices')}
            type="text"
          />
          <div>
            <Flex align="center" gap={12}>
              <Title level={4} style={{ margin: 0 }}>
                {invoice.invoiceNumber}
              </Title>
              <Tag icon={statusConfig.icon} color={statusConfig.color as any}>
                {getStatusText(invoice.status)}
              </Tag>
            </Flex>
            <Text type="secondary">
              {t('createdAt', { defaultValue: 'Created at' })}: {formatDate(invoice.createdAt)}
            </Text>
          </div>
        </Flex>

        <Space>
          <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>
            {t('previewInvoice', { defaultValue: 'Preview Invoice' })}
          </Button>
          {invoice.status !== 'paid' && (
            <Button icon={<EditOutlined />} onClick={handleEditInvoice}>
              {t('editInvoice', { defaultValue: 'Edit' })}
            </Button>
          )}
          {invoice.status === 'draft' && (
            <Button
              icon={<SendOutlined />}
              type="primary"
              onClick={handleSendInvoice}
              loading={isSending}
            >
              {t('sendInvoice', { defaultValue: 'Send Invoice' })}
            </Button>
          )}
          {invoice.status === 'sent' && (
            <Button
              icon={<CheckCircleOutlined />}
              onClick={handleMarkAsPaid}
              loading={isMarkingPaid}
            >
              {t('markAsPaid', { defaultValue: 'Mark as Paid' })}
            </Button>
          )}
          {invoice.status !== 'paid' && (
            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={handleDeleteInvoice}
              loading={isDeleting}
            >
              {t('deleteInvoice', { defaultValue: 'Delete' })}
            </Button>
          )}
          <Tooltip title={t('downloadInvoice', { defaultValue: 'Download Invoice' })}>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadInvoice} />
          </Tooltip>
        </Space>
      </Flex>

      <Row gutter={[24, 24]}>
        {/* Main Invoice Card */}
        <Col xs={24} lg={16}>
          <Card>
            {/* Invoice Amount Header */}
            <Flex justify="space-between" align="flex-start" style={{ marginBottom: 24 }}>
              <div>
                <Text type="secondary">{t('invoiceOf', { defaultValue: 'Invoice of' })}</Text>
                <Title level={2} style={{ margin: 0, color: '#52c41a' }}>
                  {formatCurrency(invoice.amount, invoice.currency)}
                </Title>
              </div>
              {invoice.isOverdue && (
                <Tag color="error" icon={<ExclamationCircleOutlined />}>
                  {t('statusOverdue', { defaultValue: 'Overdue' })}
                </Tag>
              )}
            </Flex>

            <Divider />

            {/* Invoice Details */}
            <Descriptions
              title={t('invoiceDetails', { defaultValue: 'Invoice Details' })}
              bordered
              column={{ xs: 1, sm: 2 }}
              size="small"
            >
              <Descriptions.Item label={t('invoiceNoColumn', { defaultValue: 'Invoice #' })}>
                <Text strong>{invoice.invoiceNumber}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('statusColumn', { defaultValue: 'Status' })}>
                <Tag icon={statusConfig.icon} color={statusConfig.color as any}>
                  {getStatusText(invoice.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('invoiceDate', { defaultValue: 'Invoice Date' })}>
                {formatDate(invoice.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('dueDateLabel', { defaultValue: 'Due Date' })}>
                <Text type={invoice.isOverdue ? 'danger' : undefined}>
                  {formatDate(invoice.dueDate)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('amountLabel', { defaultValue: 'Amount' })}>
                <Text strong>{formatCurrency(invoice.amount, invoice.currency)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('currencyLabel', { defaultValue: 'Currency' })}>
                {invoice.currency}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            {/* Client Details */}
            <Descriptions
              title={t('clientDetails', { defaultValue: 'Client Details' })}
              bordered
              column={{ xs: 1, sm: 2 }}
              size="small"
            >
              <Descriptions.Item label={t('clientLabel', { defaultValue: 'Client' })}>
                <Flex align="center" gap={8}>
                  <Avatar icon={<UserOutlined />} size="small" />
                  <Text strong>{invoice.client?.name || '-'}</Text>
                </Flex>
              </Descriptions.Item>
              <Descriptions.Item label={t('companyName', { defaultValue: 'Company Name' })}>
                {invoice.client?.companyName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('email', { defaultValue: 'Email' })} span={2}>
                {invoice.client?.email || '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* Request Details (if linked) */}
            {invoice.request && (
              <>
                <Divider />
                <Descriptions
                  title={t('requestDetails', { defaultValue: 'Request Details' })}
                  bordered
                  column={{ xs: 1, sm: 2 }}
                  size="small"
                >
                  <Descriptions.Item label={t('requestNumber', { defaultValue: 'Request #' })}>
                    <Text strong>{invoice.request.requestNumber}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('serviceName', { defaultValue: 'Service Name' })}>
                    {invoice.request.service?.name || '-'}
                  </Descriptions.Item>
                </Descriptions>
                {invoice.request.service?.description && (
                  <div style={{ marginTop: 16 }}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>
                      {t('serviceDescription', { defaultValue: 'Service Description' })}
                    </Text>
                    <Card size="small" style={{ backgroundColor: 'var(--ant-color-bg-layout)' }}>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(invoice.request.service.description, {
                            ALLOWED_TAGS: [
                              'p',
                              'br',
                              'strong',
                              'b',
                              'i',
                              'em',
                              'u',
                              'ul',
                              'ol',
                              'li',
                              'h1',
                              'h2',
                              'h3',
                              'h4',
                              'h5',
                              'h6',
                              'a',
                              'span',
                              'div',
                            ],
                            ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
                          }),
                        }}
                        style={{ maxHeight: 200, overflow: 'auto' }}
                      />
                    </Card>
                  </div>
                )}
              </>
            )}

            {/* Notes */}
            {invoice.notes && (
              <>
                <Divider />
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    {t('notes', { defaultValue: 'Notes' })}
                  </Text>
                  <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                    <Text>{invoice.notes}</Text>
                  </Card>
                </div>
              </>
            )}
          </Card>
        </Col>

        {/* Sidebar */}
        <Col xs={24} lg={8}>
          {/* Payment Status Card */}
          <Card
            title={t('paymentDetails', { defaultValue: 'Payment Details' })}
            style={{ marginBottom: 24 }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Flex justify="space-between">
                <Text type="secondary">{t('sentAt', { defaultValue: 'Sent At' })}</Text>
                <Text>
                  {invoice.sentAt
                    ? formatDate(invoice.sentAt)
                    : t('notSentYet', { defaultValue: 'Not sent yet' })}
                </Text>
              </Flex>
              <Flex justify="space-between">
                <Text type="secondary">{t('paidAt', { defaultValue: 'Paid At' })}</Text>
                <Text>
                  {invoice.paidAt
                    ? formatDate(invoice.paidAt)
                    : t('notPaidYet', { defaultValue: 'Not paid yet' })}
                </Text>
              </Flex>
              <Divider style={{ margin: '12px 0' }} />
              <Flex justify="space-between">
                <Text type="secondary">{t('updatedAt', { defaultValue: 'Updated At' })}</Text>
                <Text>{formatDate(invoice.updatedAt)}</Text>
              </Flex>
            </Space>
          </Card>

          {/* Payment Proof Card */}
          {invoice.status === 'paid' && invoice.paymentProofUrl && (
            <Card
              title={
                <Flex align="center" gap={8}>
                  <FileImageOutlined />
                  <Text strong>{t('paymentProof', { defaultValue: 'Payment Proof' })}</Text>
                </Flex>
              }
              style={{ marginBottom: 24 }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Flex vertical gap={12}>
                  {(() => {
                    const fileExtension =
                      invoice.paymentProofUrl?.split('.').pop()?.toLowerCase() || '';
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(
                      fileExtension
                    );
                    const isPdf = fileExtension === 'pdf';

                    if (isImage) {
                      return (
                        <div style={{ textAlign: 'center' }}>
                          <Image
                            src={invoice.paymentProofUrl}
                            alt="Payment Proof"
                            style={{
                              maxWidth: '100%',
                              maxHeight: 300,
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                            preview={{
                              visible: paymentProofPreviewOpen,
                              onVisibleChange: visible => setPaymentProofPreviewOpen(visible),
                            }}
                            onClick={() => setPaymentProofPreviewOpen(true)}
                          />
                          <Button
                            type="link"
                            icon={<EyeOutlined />}
                            onClick={() => setPaymentProofPreviewOpen(true)}
                            style={{ marginTop: 8 }}
                          >
                            {t('viewFullSize', { defaultValue: 'View Full Size' })}
                          </Button>
                        </div>
                      );
                    } else if (isPdf) {
                      return (
                        <Flex vertical gap={12} align="center">
                          <FilePdfOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
                          <Button
                            type="primary"
                            icon={<EyeOutlined />}
                            onClick={() => window.open(invoice.paymentProofUrl!, '_blank')}
                          >
                            {t('viewPdf', { defaultValue: 'View PDF' })}
                          </Button>
                          <Button
                            icon={<DownloadOutlined />}
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = invoice.paymentProofUrl!;
                              link.download = `payment-proof-${invoice.invoiceNumber}.pdf`;
                              link.click();
                              return undefined;
                            }}
                          >
                            {t('download', { defaultValue: 'Download' })}
                          </Button>
                        </Flex>
                      );
                    } else {
                      return (
                        <Flex vertical gap={12} align="center">
                          <FileTextOutlined style={{ fontSize: 48 }} />
                          <Button
                            type="primary"
                            icon={<EyeOutlined />}
                            onClick={() => window.open(invoice.paymentProofUrl!, '_blank')}
                          >
                            {t('viewFile', { defaultValue: 'View File' })}
                          </Button>
                          <Button
                            icon={<DownloadOutlined />}
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = invoice.paymentProofUrl!;
                              link.download = `payment-proof-${invoice.invoiceNumber}`;
                              link.click();
                              return undefined;
                            }}
                          >
                            {t('download', { defaultValue: 'Download' })}
                          </Button>
                        </Flex>
                      );
                    }
                  })()}
                </Flex>
              </Space>
            </Card>
          )}

          {/* Created By Card */}
          {invoice.createdBy && (
            <Card title={t('createdBy', { defaultValue: 'Created By' })}>
              <Flex align="center" gap={12}>
                <Avatar icon={<UserOutlined />} />
                <Text strong>{invoice.createdBy.name}</Text>
              </Flex>
            </Card>
          )}
        </Col>
      </Row>

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        invoice={invoice}
      />
    </div>
  );
};

export default ClientPortalInvoiceDetails;
