import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Modal, Tag, Typography } from '@/shared/antd-imports';
import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import type { ClientPortalQuoteDetails } from '../../../api/client-portal/client-portal-quotes-api';
import { formatDate } from '../../../utils/dateUtils';
import {
  QUOTE_STATUS_TAG_COLOR,
  formatMoney,
  getLineAmount,
  getQuoteDownloadUrl,
  normalizeQuoteStatus,
} from './quotes-list-helpers';
import '../invoices/invoices.css';

// The quote renders as a sheet of paper, so it keeps paper colours in both app themes: what is
// previewed is what prints and downloads.
const PAPER = {
  background: '#ffffff',
  text: '#333333',
  muted: '#8c8c8c',
  secondary: '#666666',
  border: '#f0f0f0',
  accent: '#1890ff',
  success: '#52c41a',
  danger: '#ff4d4f',
} as const;

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: PAPER.muted,
  marginBottom: 4,
};

interface QuotePreviewModalProps {
  open: boolean;
  onClose: () => void;
  quote: ClientPortalQuoteDetails;
}

/**
 * Print-ready quote: the same layout as an invoice, but "Prepared for" instead of "Billed to"
 * and "Valid until" instead of "Due date". Download is only offered for a saved quote; an
 * unsaved one (previewed from the Create Quote form) can be printed.
 */
const QuotePreviewModal = ({ open, onClose, quote }: QuotePreviewModalProps) => {
  const { t } = useTranslation('client-portal-quotes');
  const printRef = useRef<HTMLDivElement>(null);

  const accent = quote.organization?.primaryColor || PAPER.accent;
  const status = normalizeQuoteStatus(quote.status);
  const expired = status === 'expired';
  const money = (amount: number) => formatMoney(amount, quote.currency);
  const date = (value?: string | null) => (value ? formatDate(value, 'MMM D, YYYY') : '-');

  const lineItems = quote.lineItems ?? [];
  const subtotal = quote.subtotal ?? lineItems.reduce((sum, item) => sum + getLineAmount(item), 0);
  const discountAmount = quote.discountAmount ?? 0;
  const taxAmount = quote.taxAmount ?? 0;

  const statusLabel = {
    draft: t('statusDraft', { defaultValue: 'Draft' }),
    sent: t('statusSent', { defaultValue: 'Sent' }),
    accepted: t('statusAccepted', { defaultValue: 'Accepted' }),
    declined: t('statusDeclined', { defaultValue: 'Declined' }),
    expired: t('statusExpired', { defaultValue: 'Expired' }),
  }[status];

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    // Print from an isolated iframe so the app's own styles and layout never reach the page.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    const frameDocument = iframe.contentDocument;
    if (!frameDocument) {
      iframe.remove();
      return;
    }
    frameDocument.open();
    frameDocument.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${
      quote.quoteNumber
    }</title><style>
      @page { size: A4; margin: 20mm; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: ${PAPER.text}; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; background: #fafafa; }
      th, td { padding: 10px 12px; border-bottom: 1px solid ${PAPER.border}; font-size: 13px; }
      .quote-paper { border: 0 !important; padding: 0 !important; }
    </style></head><body>${content.innerHTML}</body></html>`);
    frameDocument.close();

    iframe.contentWindow?.focus();
    // Give the frame a tick to lay out before the print dialog opens.
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1000);
    }, 100);
  };

  const handleDownload = () => {
    window.open(getQuoteDownloadUrl(quote.id), '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      rootClassName="invoices-modal"
      width="min(720px, 96vw)"
      style={{ top: 24 }}
      zIndex={1100}
      title={t('quotePreview', { defaultValue: 'Quote Preview' })}
      styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' } }}
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button size="small" onClick={onClose}>
            {t('closeButton', { defaultValue: 'Close' })}
          </Button>
          <Button size="small" icon={<PrinterOutlined />} onClick={handlePrint}>
            {t('print', { defaultValue: 'Print' })}
          </Button>
          {quote.id && (
            <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
              {t('downloadQuote', { defaultValue: 'Download' })}
            </Button>
          )}
        </Flex>
      }
    >
      <div
        ref={printRef}
        className="quote-paper"
        style={{
          background: PAPER.background,
          color: PAPER.text,
          border: `1px solid ${PAPER.border}`,
          borderRadius: 8,
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: `3px solid ${accent}`,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: accent }}>
              {quote.organization?.name || t('yourCompany', { defaultValue: 'Your Company' })}
            </div>
            {[quote.organization?.email, quote.organization?.phone, quote.organization?.addressLine1]
              .filter(Boolean)
              .map(line => (
                <div key={line} style={{ fontSize: 12, color: PAPER.secondary }}>
                  {line}
                </div>
              ))}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: 2 }}>
              {t('quoteTitle', { defaultValue: 'QUOTE' })}
            </div>
            <div style={{ fontSize: 13, color: PAPER.secondary, marginBottom: 6 }}>
              #{quote.quoteNumber}
            </div>
            <Tag color={QUOTE_STATUS_TAG_COLOR[status]} style={{ marginInlineEnd: 0 }}>
              {statusLabel}
            </Tag>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: `1px solid ${PAPER.border}`,
          }}
        >
          <div>
            <div style={labelStyle}>{t('preparedFor', { defaultValue: 'Prepared for' })}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{quote.client?.name || '-'}</div>
            {[quote.client?.companyName, quote.client?.address, quote.client?.email, quote.client?.phone]
              .filter(Boolean)
              .map(line => (
                <div key={line} style={{ fontSize: 12, color: PAPER.secondary }}>
                  {line}
                </div>
              ))}
          </div>
          <div>
            <div style={labelStyle}>{t('quoteDate', { defaultValue: 'Quote Date' })}</div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
              {date(quote.createdAt)}
            </div>
            <div style={labelStyle}>{t('validUntilLabel', { defaultValue: 'Valid Until' })}</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: expired ? PAPER.danger : undefined }}>
              {date(quote.validUntil)}
            </div>
          </div>
          <div>
            <div style={labelStyle}>{t('reference', { defaultValue: 'Reference' })}</div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
              {quote.request?.requestNumber || '-'}
            </div>
            <div style={labelStyle}>{t('total', { defaultValue: 'Total' })}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: accent }}>{money(quote.amount)}</div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', background: '#fafafa' }}>
                  {t('itemDescription', { defaultValue: 'Description' })}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 12px', background: '#fafafa', width: 70 }}>
                  {t('itemQuantity', { defaultValue: 'Qty' })}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 12px', background: '#fafafa', width: 110 }}>
                  {t('itemRate', { defaultValue: 'Rate' })}
                </th>
                <th style={{ textAlign: 'right', padding: '10px 12px', background: '#fafafa', width: 110 }}>
                  {t('itemAmount', { defaultValue: 'Amount' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={item.id ?? index}>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${PAPER.border}` }}>
                    {item.description}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${PAPER.border}` }}>
                    {item.quantity}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${PAPER.border}` }}>
                    {money(item.rate)}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      borderBottom: `1px solid ${PAPER.border}`,
                      textAlign: 'right',
                      fontWeight: 600,
                    }}
                  >
                    {money(getLineAmount(item))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 260, maxWidth: '100%', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: PAPER.secondary }}>{t('subtotal', { defaultValue: 'Subtotal' })}</span>
              <span style={{ fontWeight: 600 }}>{money(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: PAPER.secondary }}>
                  {t('discount', { defaultValue: 'Discount' })} (
                  {quote.discountType === 'percentage'
                    ? `${quote.discountValue ?? 0}%`
                    : t('discountFlat', { defaultValue: 'flat' })}
                  )
                </span>
                <span style={{ color: PAPER.success }}>-{money(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: PAPER.secondary }}>
                  {t('tax', { defaultValue: 'Tax' })} ({quote.taxRate ?? 0}%)
                </span>
                <span>{money(taxAmount)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 10,
                marginTop: 4,
                borderTop: `2px solid ${PAPER.text}`,
                fontSize: 16,
              }}
            >
              <span style={{ fontWeight: 700 }}>{t('total', { defaultValue: 'Total' })}</span>
              <span style={{ fontWeight: 700, color: accent }}>{money(quote.amount)}</span>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div style={{ marginTop: 20, padding: 14, background: '#fafafa', borderRadius: 6 }}>
            <div style={labelStyle}>{t('notes', { defaultValue: 'Notes' })}</div>
            {/* Plain text only: React escapes it, and pre-wrap keeps the author's line breaks. */}
            <Typography.Text style={{ color: PAPER.secondary, whiteSpace: 'pre-wrap' }}>
              {quote.notes}
            </Typography.Text>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default QuotePreviewModal;
