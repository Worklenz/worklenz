import { useState } from 'react';
import DOMPurify from 'dompurify';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Flex,
  Image,
  Modal,
  Result,
  Skeleton,
  Tag,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  useDeleteInvoiceMutation,
  useGetInvoiceDetailsQuery,
  useSendInvoiceMutation,
} from '../../../api/client-portal/client-portal-api';
import { formatDate } from '../../../utils/dateUtils';
import InvoicePreviewModal from './invoice-details/invoice-preview-modal';
import { RecordPaymentModal } from './RecordPaymentModal';
import {
  formatMoney,
  getInvoiceDownloadUrl,
  isInvoiceOverdue,
  normalizePaymentStatus,
} from './invoices-list-helpers';
import './invoices.css';

const INVOICES_PATH = '/worklenz/client-portal/invoices';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

const STATUS_TAG_COLOR: Record<string, string> = {
  draft: 'default',
  sent: 'processing',
  pending: 'warning',
  overdue: 'error',
  cancelled: 'default',
  paid: 'success',
};

const PAYMENT_TAG_COLOR: Record<string, string> = {
  paid: 'success',
  partially_paid: 'warning',
  unpaid: 'error',
};

/** One invoice's full record, opened as a modal over the list at invoices/:invoiceId. */
const InvoiceDetailModal = () => {
  const { t } = useTranslation('client-portal-invoices');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { invoiceId } = useParams<{ invoiceId: string }>();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useGetInvoiceDetailsQuery(invoiceId ?? '', {
    skip: !invoiceId,
  });
  const invoice = data?.body;

  const [sendInvoice, { isLoading: isSending }] = useSendInvoiceMutation();
  const [deleteInvoice] = useDeleteInvoiceMutation();

  // Back to wherever this was opened from, or to the list for a direct link.
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(INVOICES_PATH);
  };

  const statusLabel = (status: string) =>
    ({
      draft: t('statusDraft', { defaultValue: 'Draft' }),
      sent: t('statusSent', { defaultValue: 'Sent' }),
      pending: t('statusPending', { defaultValue: 'Pending' }),
      overdue: t('statusOverdue', { defaultValue: 'Overdue' }),
      cancelled: t('statusCancelled', { defaultValue: 'Cancelled' }),
      paid: t('statusPaid', { defaultValue: 'Paid' }),
    })[status] ?? status;

  const paymentLabel = (status: string) =>
    ({
      paid: t('paymentStatusPaid', { defaultValue: 'Paid' }),
      partially_paid: t('paymentStatusPartiallyPaid', { defaultValue: 'Partially Paid' }),
      unpaid: t('paymentStatusUnpaid', { defaultValue: 'Unpaid' }),
    })[status] ?? status;

  const showError = (err: unknown, fallback: string) => {
    const serverMessage = (err as { data?: { message?: string } })?.data?.message;
    message.error(serverMessage || fallback);
  };

  const handleSend = async () => {
    if (!invoiceId) return;
    try {
      await sendInvoice(invoiceId).unwrap();
      message.success(t('sendInvoiceSuccess', { defaultValue: 'Invoice sent successfully' }));
    } catch (err) {
      showError(err, t('sendInvoiceError', { defaultValue: 'Failed to send invoice' }));
    }
  };

  const handleDelete = () => {
    if (!invoiceId) return;
    Modal.confirm({
      title: t('deleteConfirmationTitle', { defaultValue: 'Delete Invoice' }),
      content: t('deleteConfirmationDescription', {
        defaultValue: 'Are you sure you want to delete this invoice? This cannot be undone.',
      }),
      okText: t('deleteConfirmationOk', { defaultValue: 'Delete' }),
      cancelText: t('deleteConfirmationCancel', { defaultValue: 'Cancel' }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteInvoice(invoiceId).unwrap();
          message.success(
            t('deleteInvoice.success', { defaultValue: 'Invoice deleted successfully' })
          );
          navigate(INVOICES_PATH);
        } catch (err) {
          showError(err, t('deleteInvoice.failure', { defaultValue: 'Failed to delete invoice' }));
        }
      },
    });
  };

  const handleDownload = () => {
    if (invoiceId) window.open(getInvoiceDownloadUrl(invoiceId), '_blank', 'noopener,noreferrer');
  };

  const field = (label: string, value: React.ReactNode) => (
    <div key={label}>
      <div className="invoices-detail-label" style={{ color: token.colorTextSecondary }}>
        {label}
      </div>
      <div style={{ fontWeight: 600 }}>{value ?? '-'}</div>
    </div>
  );

  const boxedText = (value?: React.ReactNode) => (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        padding: '8px 10px',
        color: token.colorTextSecondary,
      }}
    >
      {value || '-'}
    </div>
  );

  const renderProof = (url: string, number: string) => {
    const extension = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    if (IMAGE_EXTENSIONS.includes(extension)) {
      return (
        <Image
          src={url}
          alt={t('paymentProof', { defaultValue: 'Payment Proof' })}
          style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 6 }}
          preview={{ mask: t('viewFullSize', { defaultValue: 'View Full Size' }) }}
        />
      );
    }
    return (
      <Flex vertical align="center" gap={8}>
        {extension === 'pdf' ? (
          <FilePdfOutlined style={{ fontSize: 36, color: token.colorError }} />
        ) : (
          <FileTextOutlined style={{ fontSize: 36 }} />
        )}
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        >
          {t('viewFullSize', { defaultValue: 'View Full Size' })}
        </Button>
        <Typography.Text type="secondary" className="invoices-meta">
          {number}
        </Typography.Text>
      </Flex>
    );
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = <Skeleton active paragraph={{ rows: 8 }} />;
  } else if (isError || !invoice) {
    body = (
      <Result
        status="error"
        title={t('errorLoadingInvoice', { defaultValue: 'Unable to load invoice' })}
        subTitle={t('errorLoadingInvoiceDescription', {
          defaultValue: 'There was a problem loading this invoice. Please try again later.',
        })}
        extra={[
          <Button key="retry" size="small" onClick={() => refetch()}>
            {t('retryButton', { defaultValue: 'Retry' })}
          </Button>,
          <Button key="back" size="small" type="primary" onClick={goBack}>
            {t('backToInvoices', { defaultValue: 'Back to invoices' })}
          </Button>,
        ]}
      />
    );
  } else {
    const paymentStatus = normalizePaymentStatus(invoice.paymentStatus);
    const isPaid = paymentStatus === 'paid';
    const overdue = isInvoiceOverdue(invoice);
    const money = (amount: number) => formatMoney(amount, invoice.currency);
    const serviceDescription = invoice.request?.service?.description;

    body = (
      <Flex vertical gap={16}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
          <Typography.Text type="secondary">
            {t('createdAt', { defaultValue: 'Created At' })}:{' '}
            {invoice.createdAt ? formatDate(invoice.createdAt, 'MMM D, YYYY') : '-'}
          </Typography.Text>
          <Flex gap={8} wrap="wrap">
            {!isPaid && (
              <Button type="primary" size="small" onClick={() => setPaymentOpen(true)}>
                {t('recordPaymentTitle', { defaultValue: 'Record Payment' })}
              </Button>
            )}
            <Button size="small" icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>
              {t('previewInvoice', { defaultValue: 'Preview' })}
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              aria-label={t('downloadInvoice', { defaultValue: 'Download' })}
            />
          </Flex>
        </Flex>

        <div className="invoices-columns">
          <div className="invoices-column-main">
            <Flex vertical gap={16}>
              <Card size="small">
                <div className="invoices-detail-label" style={{ color: token.colorTextSecondary }}>
                  {t('invoiceOf', { defaultValue: 'Invoice Total' })}
                </div>
                <div className="invoices-total-hero" style={{ color: token.colorSuccess }}>
                  {money(invoice.amount)}
                </div>
                {paymentStatus === 'partially_paid' && (
                  <Typography.Text type="secondary" className="invoices-meta">
                    {t('paidOfTotal', {
                      paid: money(invoice.paidAmount ?? 0),
                      total: money(invoice.amount),
                      defaultValue: '{{paid}} paid of {{total}}',
                    })}
                  </Typography.Text>
                )}
              </Card>

              <Card size="small" title={t('invoiceDetails', { defaultValue: 'Invoice Details' })}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  {field(t('invoiceNoColumn', { defaultValue: 'Invoice' }), invoice.invoiceNumber)}
                  {field(
                    t('statusColumn', { defaultValue: 'Status' }),
                    <Tag color={STATUS_TAG_COLOR[invoice.status] ?? 'default'}>
                      {statusLabel(invoice.status)}
                    </Tag>
                  )}
                  {field(
                    t('paymentStatusColumn', { defaultValue: 'Payment Status' }),
                    <Tag color={PAYMENT_TAG_COLOR[paymentStatus]}>{paymentLabel(paymentStatus)}</Tag>
                  )}
                  {field(
                    t('invoiceDate', { defaultValue: 'Invoice Date' }),
                    invoice.createdAt ? formatDate(invoice.createdAt, 'MMM D, YYYY') : '-'
                  )}
                  {field(
                    t('dueDateLabel', { defaultValue: 'Due Date' }),
                    <span style={{ color: overdue ? token.colorError : undefined }}>
                      {invoice.dueDate ? formatDate(invoice.dueDate, 'MMM D, YYYY') : '-'}
                    </span>
                  )}
                  {field(t('amountLabel', { defaultValue: 'Amount' }), money(invoice.amount))}
                  {field(t('currencyLabel', { defaultValue: 'Currency' }), invoice.currency?.toUpperCase())}
                </div>
              </Card>

              <Card size="small" title={t('clientDetails', { defaultValue: 'Client Details' })}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  {field(
                    t('clientLabel', { defaultValue: 'Client' }),
                    <Flex align="center" gap={6}>
                      <Avatar size={20} icon={<UserOutlined />} />
                      {invoice.client?.name || '-'}
                    </Flex>
                  )}
                  {field(t('companyName', { defaultValue: 'Company' }), invoice.client?.companyName || '-')}
                  {field(t('email', { defaultValue: 'Email' }), invoice.client?.email || '-')}
                </div>
              </Card>

              <Card size="small" title={t('requestDetails', { defaultValue: 'Request Details' })}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                  {/* A standalone invoice has no request; these read "-" rather than erroring. */}
                  {field(t('requestNumber', { defaultValue: 'Request Number' }), invoice.request?.requestNumber || '-')}
                  {field(t('serviceName', { defaultValue: 'Service' }), invoice.request?.service?.name || invoice.projectName || '-')}
                </div>
                <div className="invoices-detail-label" style={{ color: token.colorTextSecondary }}>
                  {t('serviceDescription', { defaultValue: 'Service Description' })}
                </div>
                {boxedText(
                  serviceDescription ? (
                    <div
                      style={{ maxHeight: 160, overflow: 'auto' }}
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(serviceDescription, {
                          ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'div'],
                          ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
                        }),
                      }}
                    />
                  ) : null
                )}
              </Card>

              <Card size="small" title={t('notes', { defaultValue: 'Notes' })}>
                {boxedText(invoice.notes)}
              </Card>
            </Flex>
          </div>

          <div className="invoices-column-side">
            <Flex vertical gap={16}>
              <Card size="small" title={t('paymentDetails', { defaultValue: 'Payment Details' })}>
                <Flex vertical gap={8}>
                  {[
                    [t('sentAt', { defaultValue: 'Sent At' }), invoice.sentAt],
                    [t('paidAt', { defaultValue: 'Paid At' }), invoice.paidAt],
                    [t('updatedAt', { defaultValue: 'Updated At' }), invoice.updatedAt],
                  ].map(([label, value]) => (
                    <Flex key={label as string} justify="space-between" gap={8}>
                      <Typography.Text type="secondary">{label}</Typography.Text>
                      <Typography.Text strong>
                        {value ? formatDate(value as string, 'MMM D, YYYY') : '-'}
                      </Typography.Text>
                    </Flex>
                  ))}
                </Flex>
              </Card>

              <Card size="small" title={t('paymentProof', { defaultValue: 'Payment Proof' })}>
                {invoice.paymentProofUrl ? (
                  renderProof(invoice.paymentProofUrl, invoice.invoiceNumber)
                ) : (
                  <Typography.Text type="secondary">
                    {t('noPaymentProof', { defaultValue: 'No payment proof uploaded.' })}
                  </Typography.Text>
                )}
              </Card>

              <Card size="small" title={t('createdBy', { defaultValue: 'Created By' })}>
                <Flex align="center" gap={8}>
                  <Avatar size={26} icon={<UserOutlined />} />
                  <Typography.Text strong>{invoice.createdBy?.name || '-'}</Typography.Text>
                </Flex>
              </Card>
            </Flex>
          </div>
        </div>

        <RecordPaymentModal
          open={paymentOpen}
          invoice={invoice}
          initialStatus={paymentStatus === 'partially_paid' ? 'partially_paid' : 'paid'}
          onClose={() => setPaymentOpen(false)}
        />
        <InvoicePreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} invoice={invoice} />
      </Flex>
    );
  }

  const canModify = invoice && normalizePaymentStatus(invoice.paymentStatus) !== 'paid';
  const canDelete = invoice && normalizePaymentStatus(invoice.paymentStatus) === 'unpaid';

  return (
    <Modal
      open
      onCancel={goBack}
      rootClassName="invoices-modal"
      width="min(960px, 96vw)"
      style={{ top: 24 }}
      styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' } }}
      title={
        invoice ? (
          <Flex align="center" gap={8} wrap="wrap">
            <Typography.Text strong style={{ fontSize: 14 }}>
              {invoice.invoiceNumber}
            </Typography.Text>
            <Tag color={STATUS_TAG_COLOR[invoice.status] ?? 'default'}>
              {statusLabel(invoice.status)}
            </Tag>
            <Tag color={PAYMENT_TAG_COLOR[normalizePaymentStatus(invoice.paymentStatus)]}>
              {paymentLabel(normalizePaymentStatus(invoice.paymentStatus))}
            </Tag>
          </Flex>
        ) : null
      }
      footer={
        invoice ? (
          <Flex justify="space-between" gap={8} wrap="wrap">
            <Flex gap={8}>
              {canDelete && (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={handleDelete}>
                  {t('deleteInvoice', { defaultValue: 'Delete' })}
                </Button>
              )}
            </Flex>
            <Flex gap={8}>
              <Button size="small" onClick={goBack}>
                {t('closeButton', { defaultValue: 'Close' })}
              </Button>
              {canModify && (
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`${INVOICES_PATH}/${invoice.id}/edit`)}
                >
                  {t('editInvoice', { defaultValue: 'Edit' })}
                </Button>
              )}
              {invoice.status === 'draft' && (
                <Button
                  type="primary"
                  size="small"
                  icon={<SendOutlined />}
                  loading={isSending}
                  onClick={handleSend}
                >
                  {t('sendInvoice', { defaultValue: 'Send Invoice' })}
                </Button>
              )}
            </Flex>
          </Flex>
        ) : null
      }
    >
      {body}
    </Modal>
  );
};

export default InvoiceDetailModal;
