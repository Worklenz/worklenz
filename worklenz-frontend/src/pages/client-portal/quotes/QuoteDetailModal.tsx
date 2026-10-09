import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Flex,
  Modal,
  Result,
  Skeleton,
  Tag,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import { DeleteOutlined, DownloadOutlined, EyeOutlined, UserOutlined } from '@ant-design/icons';
import {
  useDeleteQuoteMutation,
  useGetQuoteDetailsQuery,
} from '../../../api/client-portal/client-portal-quotes-api';
import { formatDate } from '../../../utils/dateUtils';
import QuotePreviewModal from './quote-preview-modal';
import {
  QUOTE_STATUS_TAG_COLOR,
  formatMoney,
  getQuoteDownloadUrl,
  isQuoteExpired,
  normalizeQuoteStatus,
} from './quotes-list-helpers';
import '../invoices/invoices.css';

const QUOTES_PATH = '/worklenz/client-portal/quotes';

/** One quote's full record, opened as a modal over the list at quotes/:quoteId. */
const QuoteDetailModal = () => {
  const { t } = useTranslation('client-portal-quotes');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { quoteId } = useParams<{ quoteId: string }>();

  const [previewOpen, setPreviewOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useGetQuoteDetailsQuery(quoteId ?? '', {
    skip: !quoteId,
  });
  const quote = data?.body;

  const [deleteQuote] = useDeleteQuoteMutation();

  // Back to wherever this was opened from, or to the list for a direct link.
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(QUOTES_PATH);
  };

  const statusLabel = (status: string) =>
    ({
      draft: t('statusDraft', { defaultValue: 'Draft' }),
      sent: t('statusSent', { defaultValue: 'Sent' }),
      accepted: t('statusAccepted', { defaultValue: 'Accepted' }),
      declined: t('statusDeclined', { defaultValue: 'Declined' }),
      expired: t('statusExpired', { defaultValue: 'Expired' }),
    })[status] ?? status;

  const handleDelete = () => {
    if (!quoteId || !quote) return;
    Modal.confirm({
      title: t('deleteConfirmationTitle', { defaultValue: 'Delete Quote' }),
      content: t('deleteConfirmationDescription', {
        number: quote.quoteNumber,
        defaultValue: 'Are you sure you want to delete {{number}}? This cannot be undone.',
      }),
      okText: t('deleteConfirmationOk', { defaultValue: 'Delete' }),
      cancelText: t('cancelButton', { defaultValue: 'Cancel' }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteQuote(quoteId).unwrap();
          message.success(t('deleteQuoteSuccess', { defaultValue: 'Quote deleted successfully' }));
          navigate(QUOTES_PATH);
        } catch (err) {
          const serverMessage = (err as { data?: { message?: string } })?.data?.message;
          message.error(
            serverMessage || t('deleteQuoteError', { defaultValue: 'Failed to delete quote' })
          );
        }
      },
    });
  };

  const handleDownload = () => {
    if (quoteId) window.open(getQuoteDownloadUrl(quoteId), '_blank', 'noopener,noreferrer');
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
        whiteSpace: 'pre-wrap',
      }}
    >
      {value || '-'}
    </div>
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = <Skeleton active paragraph={{ rows: 8 }} />;
  } else if (isError || !quote) {
    body = (
      <Result
        status="error"
        title={t('errorLoadingQuote', { defaultValue: 'Unable to load quote' })}
        subTitle={t('errorLoadingQuoteDescription', {
          defaultValue: 'There was a problem loading this quote. Please try again later.',
        })}
        extra={[
          <Button key="retry" size="small" onClick={() => refetch()}>
            {t('retryButton', { defaultValue: 'Retry' })}
          </Button>,
          <Button key="back" size="small" type="primary" onClick={goBack}>
            {t('backToQuotes', { defaultValue: 'Back to quotes' })}
          </Button>,
        ]}
      />
    );
  } else {
    const status = normalizeQuoteStatus(quote.status);
    const money = (amount: number) => formatMoney(amount, quote.currency);

    body = (
      <Flex vertical gap={16}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
          <Typography.Text type="secondary">
            {t('createdAt', { defaultValue: 'Created At' })}:{' '}
            {quote.createdAt ? formatDate(quote.createdAt, 'MMM D, YYYY') : '-'}
          </Typography.Text>
          <Flex gap={8} wrap="wrap">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>
              {t('previewQuote', { defaultValue: 'Preview' })}
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              aria-label={t('downloadQuote', { defaultValue: 'Download' })}
            />
          </Flex>
        </Flex>

        <div className="invoices-columns">
          <div className="invoices-column-main">
            <Flex vertical gap={16}>
              <Card size="small">
                <div className="invoices-detail-label" style={{ color: token.colorTextSecondary }}>
                  {t('quoteTotal', { defaultValue: 'Quote Total' })}
                </div>
                <div className="invoices-total-hero" style={{ color: token.colorSuccess }}>
                  {money(quote.amount)}
                </div>
              </Card>

              <Card size="small" title={t('quoteDetails', { defaultValue: 'Quote Details' })}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 12,
                  }}
                >
                  {field(t('quoteNoColumn', { defaultValue: 'Quote' }), quote.quoteNumber)}
                  {field(
                    t('statusColumn', { defaultValue: 'Status' }),
                    <Tag color={QUOTE_STATUS_TAG_COLOR[status]}>{statusLabel(status)}</Tag>
                  )}
                  {field(
                    t('quoteDate', { defaultValue: 'Quote Date' }),
                    quote.createdAt ? formatDate(quote.createdAt, 'MMM D, YYYY') : '-'
                  )}
                  {field(
                    t('validUntilLabel', { defaultValue: 'Valid Until' }),
                    // Red once the quote has been marked Expired.
                    <span style={{ color: isQuoteExpired(quote) ? token.colorError : undefined }}>
                      {quote.validUntil ? formatDate(quote.validUntil, 'MMM D, YYYY') : '-'}
                    </span>
                  )}
                  {field(t('amountLabel', { defaultValue: 'Amount' }), money(quote.amount))}
                  {field(t('currencyLabel', { defaultValue: 'Currency' }), quote.currency?.toUpperCase())}
                </div>
              </Card>

              <Card size="small" title={t('clientDetails', { defaultValue: 'Client Details' })}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 12,
                  }}
                >
                  {field(
                    t('clientLabel', { defaultValue: 'Client' }),
                    <Flex align="center" gap={6}>
                      <Avatar size={20} icon={<UserOutlined />} />
                      {quote.client?.name || '-'}
                    </Flex>
                  )}
                  {field(t('companyName', { defaultValue: 'Company' }), quote.client?.companyName || '-')}
                  {field(t('email', { defaultValue: 'Email' }), quote.client?.email || '-')}
                </div>
              </Card>

              {/* A standalone quote has no request, so the card is left out rather than showing blanks. */}
              {quote.request && (
                <Card size="small" title={t('requestDetails', { defaultValue: 'Request Details' })}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: 12,
                    }}
                  >
                    {field(
                      t('requestNumber', { defaultValue: 'Request Number' }),
                      quote.request.requestNumber || '-'
                    )}
                    {field(
                      t('serviceName', { defaultValue: 'Service' }),
                      quote.request.service?.name || quote.projectName || '-'
                    )}
                  </div>
                </Card>
              )}

              <Card size="small" title={t('notes', { defaultValue: 'Notes' })}>
                {boxedText(quote.notes)}
              </Card>
            </Flex>
          </div>

          <div className="invoices-column-side">
            <Flex vertical gap={16}>
              <Card size="small" title={t('reference', { defaultValue: 'Reference' })}>
                <Typography.Text strong>{quote.request?.requestNumber || '-'}</Typography.Text>
              </Card>

              <Card size="small" title={t('createdBy', { defaultValue: 'Created By' })}>
                <Flex align="center" gap={8}>
                  <Avatar size={26} icon={<UserOutlined />} />
                  <Typography.Text strong>{quote.createdBy?.name || '-'}</Typography.Text>
                </Flex>
              </Card>
            </Flex>
          </div>
        </div>

        <QuotePreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} quote={quote} />
      </Flex>
    );
  }

  return (
    <Modal
      open
      onCancel={goBack}
      rootClassName="invoices-modal"
      width="min(960px, 96vw)"
      style={{ top: 24 }}
      styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' } }}
      title={
        quote ? (
          <Flex align="center" gap={8} wrap="wrap">
            <Typography.Text strong style={{ fontSize: 14 }}>
              {quote.quoteNumber}
            </Typography.Text>
            <Tag color={QUOTE_STATUS_TAG_COLOR[normalizeQuoteStatus(quote.status)]}>
              {statusLabel(quote.status)}
            </Tag>
          </Flex>
        ) : null
      }
      footer={
        <Flex justify="space-between" gap={8} wrap="wrap">
          <Flex gap={8}>
            {quote && (
              <Button size="small" danger icon={<DeleteOutlined />} onClick={handleDelete}>
                {t('deleteMenuItem', { defaultValue: 'Delete' })}
              </Button>
            )}
          </Flex>
          <Button size="small" onClick={goBack}>
            {t('closeButton', { defaultValue: 'Close' })}
          </Button>
        </Flex>
      }
    >
      {body}
    </Modal>
  );
};

export default QuoteDetailModal;
