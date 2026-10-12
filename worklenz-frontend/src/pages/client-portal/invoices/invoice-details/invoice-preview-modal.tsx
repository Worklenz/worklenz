import React, { useRef } from 'react';
import {
  Modal,
  Typography,
  Button,
  Divider,
  Table,
  Flex,
  Space,
  Row,
  Col,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  PrinterOutlined,
  DownloadOutlined,
  CloseOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from 'antd';
import { ClientPortalInvoiceDetails } from '@/api/client-portal/client-portal-api';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getInvoiceDownloadUrl } from '../invoices-list-helpers';
import { isInvoiceOverdue, normalizePaymentStatus } from '../invoices-list-helpers';
import '../invoices.css';

const { Title, Text } = Typography;

// Line items and notes are typed by staff and written into a print document, so escape them.
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const { useToken } = theme;

interface InvoicePreviewModalProps {
  open: boolean;
  onClose: () => void;
  invoice: ClientPortalInvoiceDetails;
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({ open, onClose, invoice }) => {
  // Get organization details from invoice or use defaults
  const organizationName = invoice.organization?.name || 'Your Company';
  const organizationEmail = invoice.organization?.email || '';
  const organizationPhone = invoice.organization?.phone || '';
  const organizationAddressLine1 = invoice.organization?.addressLine1 || '';
  const organizationAddressLine2 = invoice.organization?.addressLine2 || '';
  const organizationCityStateZip = [
    [invoice.organization?.city, invoice.organization?.state].filter(Boolean).join(', '),
    invoice.organization?.zipCode,
  ]
    .filter(Boolean)
    .join(' ');
  const organizationCountry = invoice.organization?.country || '';
  const organizationLogo = invoice.organization?.logoUrl || undefined;
  const invoiceFooterMessage = invoice.organization?.invoiceFooterMessage || '';
  const templateStyle = invoice.organization?.templateStyle === 'modern' ? 'modern' : 'classic';
  const showLogo = invoice.organization?.showLogo !== false;
  const { t } = useTranslation('client-portal-invoices');
  const printRef = useRef<HTMLDivElement>(null);
  const { token } = useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const navigate = useNavigate();

  // Navigate to client portal settings to edit company details
  const handleEditCompanyDetails = () => {
    onClose();
    navigate('/worklenz/client-portal/settings');
  };

  // Handle download invoice
  const handleDownload = () => {
    window.open(getInvoiceDownloadUrl(invoice.id), '_blank', 'noopener,noreferrer');
  };

  // Theme-aware colors
  const colors = {
    background: isDark ? token.colorBgContainer : '#ffffff',
    backgroundSecondary: isDark ? token.colorBgElevated : '#fafafa',
    text: isDark ? token.colorText : '#333333',
    textSecondary: isDark ? token.colorTextSecondary : '#666666',
    border: isDark ? token.colorBorderSecondary : '#f0f0f0',
    primary: token.colorPrimary,
    success: token.colorSuccess,
    error: token.colorError,
    warning: token.colorWarning,
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

  // The badge on the document shows how much has been paid, not the lifecycle status.
  const paymentStatus = normalizePaymentStatus(invoice.paymentStatus);
  const isOverdue = isInvoiceOverdue(invoice);
  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return t('paymentStatusPaid', { defaultValue: 'Paid' });
      case 'partially_paid':
        return t('paymentStatusPartiallyPaid', { defaultValue: 'Partially Paid' });
      default:
        return t('paymentStatusUnpaid', { defaultValue: 'Unpaid' });
    }
  };

  // Get status badge style for print
  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'paid':
        return 'background: #f6ffed; color: #52c41a;';
      case 'partially_paid':
        return 'background: #fff7e6; color: #d46b08;';
      default:
        return 'background: #fff2f0; color: #ff4d4f;';
    }
  };

  // Build client address string
  const getClientAddress = () => {
    const parts = [];
    if (invoice.client?.companyName) parts.push(invoice.client.companyName);
    if (invoice.client?.address) parts.push(invoice.client.address);
    if (invoice.client?.email) parts.push(invoice.client.email);
    if (invoice.client?.phone) parts.push(invoice.client.phone);
    return parts;
  };

  // Handle print - generates a clean, professional print-ready invoice
  const handlePrint = () => {
    const primaryColor = invoice.organization?.primaryColor || '#1890ff';
    const clientAddressParts = getClientAddress();
    const printLineItems = lineItems;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${t('title')} - ${invoice.invoiceNumber}</title>
          <style>
            @page {
              size: A4;
              margin: 20mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              color: #333;
              line-height: 1.5;
              background: #fff;
            }
            .invoice-container {
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid ${primaryColor};
            }
            .company-section {
              display: flex;
              align-items: center;
              gap: 16px;
            }
            .company-logo {
              width: 60px;
              height: 60px;
              border-radius: 8px;
              background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #fff;
              font-weight: 700;
              font-size: 28px;
            }
            .company-logo img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              border-radius: 8px;
            }
            .company-info h1 {
              font-size: 24px;
              color: ${primaryColor};
              margin-bottom: 4px;
            }
            .company-info p {
              font-size: 13px;
              color: #666;
              margin: 2px 0;
            }
            .invoice-title-section {
              text-align: right;
            }
            .invoice-title-section h2 {
              font-size: 36px;
              color: #333;
              font-weight: 300;
              letter-spacing: 2px;
              margin-bottom: 8px;
            }
            .invoice-number {
              font-size: 16px;
              color: #666;
              margin-bottom: 8px;
            }
            .status-badge {
              display: inline-block;
              padding: 6px 16px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              ${getStatusBadgeStyle(paymentStatus)}
            }
            .meta-section {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
              gap: 40px;
            }
            .bill-to, .invoice-details {
              flex: 1;
            }
            .section-label {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #999;
              margin-bottom: 8px;
              font-weight: 600;
            }
            .bill-to-name {
              font-size: 18px;
              font-weight: 600;
              color: #333;
              margin-bottom: 4px;
            }
            .bill-to-details {
              font-size: 14px;
              color: #666;
            }
            .invoice-details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
            }
            .detail-item .label {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #999;
              margin-bottom: 4px;
            }
            .detail-item .value {
              font-size: 14px;
              font-weight: 500;
              color: #333;
            }
            .detail-item .value.highlight {
              font-size: 20px;
              color: ${primaryColor};
              font-weight: 700;
            }
            .detail-item .value.danger {
              color: #ff4d4f;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .items-table th {
              background: #f8f9fa;
              padding: 14px 16px;
              text-align: left;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #666;
              font-weight: 600;
              border-bottom: 2px solid #e8e8e8;
            }
            .items-table th:last-child,
            .items-table td:last-child {
              text-align: right;
            }
            .items-table th:nth-child(2),
            .items-table th:nth-child(3),
            .items-table td:nth-child(2),
            .items-table td:nth-child(3) {
              text-align: center;
            }
            .items-table td {
              padding: 16px;
              border-bottom: 1px solid #eee;
              font-size: 14px;
              color: #333;
            }
            .totals-section {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 40px;
            }
            .totals-box {
              width: 280px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              font-size: 14px;
              color: #666;
            }
            .totals-row.total {
              font-size: 18px;
              font-weight: 700;
              color: #333;
              border-top: 2px solid #333;
              padding-top: 16px;
              margin-top: 8px;
            }
            .totals-row.total .amount {
              color: ${primaryColor};
              font-size: 22px;
            }
            .notes-section {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 40px;
            }
            .notes-section h3 {
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #666;
              margin-bottom: 10px;
            }
            .notes-section p {
              font-size: 14px;
              color: #555;
              line-height: 1.6;
            }
            .footer {
              text-align: center;
              padding-top: 30px;
              border-top: 1px solid #eee;
            }
            .footer p {
              font-size: 13px;
              color: #999;
            }
            .footer .thank-you {
              font-size: 16px;
              color: #666;
              margin-bottom: 8px;
            }
            @media print {
              .invoice-container {
                padding: 0;
              }
            }
            .invoice-container.modern {
              border-left: 6px solid ${primaryColor};
              padding-left: 34px;
            }
            .invoice-container.modern .header {
              border-bottom: none;
              padding-bottom: 0;
            }
            .invoice-container.modern .invoice-title-section h2 {
              color: ${primaryColor};
              font-weight: 700;
              letter-spacing: 0;
            }
            .invoice-container.modern .items-table th {
              background: transparent;
              border-bottom: 2px solid ${primaryColor};
            }
            .invoice-container.modern .items-table td {
              border-bottom: none;
            }
            .invoice-container.modern .items-table tr:nth-child(even) td {
              background: #fafafa;
            }
          </style>
        </head>
        <body>
          <div class="invoice-container${templateStyle === 'modern' ? ' modern' : ''}">
            <div class="header">
              <div class="company-section">
                ${showLogo ? `<div class="company-logo">
                  ${
                    organizationLogo
                      ? `<img src="${organizationLogo}" alt="Logo" />`
                      : organizationName.charAt(0).toUpperCase()
                  }
                </div>` : ''}
                <div class="company-info">
                  <h1>${organizationName}</h1>
                  ${organizationEmail ? `<p>${organizationEmail}</p>` : ''}
                  ${organizationPhone ? `<p>${organizationPhone}</p>` : ''}
                  ${organizationAddressLine1 ? `<p>${organizationAddressLine1}</p>` : ''}
                  ${organizationAddressLine2 ? `<p>${organizationAddressLine2}</p>` : ''}
                  ${organizationCityStateZip ? `<p>${organizationCityStateZip}</p>` : ''}
                  ${organizationCountry ? `<p>${organizationCountry}</p>` : ''}
                </div>
              </div>
              <div class="invoice-title-section">
                <h2>${t('invoiceTitle').toUpperCase()}</h2>
                <p class="invoice-number">#${invoice.invoiceNumber}</p>
                <span class="status-badge">${getStatusText(paymentStatus)}</span>
              </div>
            </div>

            <div class="meta-section">
              <div class="bill-to">
                <p class="section-label">${t('billedTo')}</p>
                <p class="bill-to-name">${invoice.client?.name || '-'}</p>
                <div class="bill-to-details">
                  ${clientAddressParts.map(part => `<p>${part}</p>`).join('')}
                </div>
              </div>
              <div class="invoice-details">
                <div class="invoice-details-grid">
                  <div class="detail-item">
                    <p class="label">${t('invoiceDate')}</p>
                    <p class="value">${formatDate(invoice.createdAt)}</p>
                  </div>
                  <div class="detail-item">
                    <p class="label">${t('dueDateLabel')}</p>
                    <p class="value ${isOverdue ? 'danger' : ''}">${formatDate(invoice.dueDate)}</p>
                  </div>
                  <div class="detail-item">
                    <p class="label">${t('reference')}</p>
                    <p class="value">${invoice.request?.requestNumber || '-'}</p>
                  </div>
                  <div class="detail-item">
                    <p class="label">${t('total')}</p>
                    <p class="value highlight">${formatCurrency(invoice.amount, invoice.currency)}</p>
                  </div>
                </div>
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>${t('itemDescription')}</th>
                  <th>${t('itemQuantity')}</th>
                  <th>${t('itemRate')}</th>
                  <th>${t('itemAmount')}</th>
                </tr>
              </thead>
              <tbody>
                ${printLineItems
                  .map(
                    item => `
                <tr>
                  <td>${escapeHtml(item.description)}</td>
                  <td>${item.quantity}</td>
                  <td>${formatCurrency(item.rate, invoice.currency)}</td>
                  <td>${formatCurrency(item.amount, invoice.currency)}</td>
                </tr>`
                  )
                  .join('')}
              </tbody>
            </table>

            <div class="totals-section">
              <div class="totals-box">
                <div class="totals-row">
                  <span>${t('subtotal')}</span>
                  <span>${formatCurrency(invoice.subtotal || invoice.amount, invoice.currency)}</span>
                </div>
                ${
                  invoice.discountAmount && invoice.discountAmount > 0
                    ? `
                  <div class="totals-row">
                    <span>${t('discount')} (${invoice.discountType === 'percentage' ? `${invoice.discountValue}%` : formatCurrency(invoice.discountValue || 0, invoice.currency)})</span>
                    <span>-${formatCurrency(invoice.discountAmount, invoice.currency)}</span>
                  </div>
                `
                    : ''
                }
                ${
                  invoice.taxAmount && invoice.taxAmount > 0
                    ? `
                  <div class="totals-row">
                    <span>${t('tax')} (${invoice.taxRate || 0}%)</span>
                    <span>${formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                  </div>
                `
                    : ''
                }
                <div class="totals-row total">
                  <span>${t('total')}</span>
                  <span class="amount">${formatCurrency(invoice.amount, invoice.currency)}</span>
                </div>
              </div>
            </div>

            ${
              invoice.notes
                ? `
              <div class="notes-section">
                <h3>${t('notes')}</h3>
                <p>${escapeHtml(invoice.notes)}</p>
              </div>
            `
                : ''
            }

            <div class="footer">
              ${invoiceFooterMessage ? `<p class="thank-you">${invoiceFooterMessage}</p>` : ''}
              <p>${organizationName}${organizationEmail ? ` • ${organizationEmail}` : ''}${organizationPhone ? ` • ${organizationPhone}` : ''}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Create an iframe for printing (more reliable than window.open)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(printContent);
      iframeDoc.close();

      // Wait for content to render then print
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print error:', e);
        }
        // Remove iframe after printing
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 300);
    }
  };

  // Saved line items, or one line for the whole amount for invoices created before line items existed.
  const lineItems = (
    invoice.lineItems?.length
      ? invoice.lineItems
      : [
          {
            description: invoice.request?.service?.name || invoice.projectName || t('serviceItems'),
            quantity: 1,
            rate: invoice.subtotal || invoice.amount,
            amount: invoice.subtotal || invoice.amount,
          },
        ]
  ).map((item, index) => ({ key: String(index), ...item }));

  const columns = [
    {
      title: t('itemDescription'),
      dataIndex: 'description',
      key: 'description',
      width: '50%',
    },
    {
      title: t('itemQuantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center' as const,
      width: '15%',
    },
    {
      title: t('itemRate'),
      dataIndex: 'rate',
      key: 'rate',
      align: 'right' as const,
      width: '17.5%',
      render: (value: number) => formatCurrency(value, invoice.currency),
    },
    {
      title: t('itemAmount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      width: '17.5%',
      render: (value: number) => formatCurrency(value, invoice.currency),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      rootClassName="invoices-modal"
      width="min(900px, 96vw)"
      title={<Text strong style={{ fontSize: 14 }}>{t('invoicePreview')}</Text>}
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            {t('print')}
          </Button>
          {invoice.id && (
            <Button icon={<DownloadOutlined />} type="primary" onClick={handleDownload}>
              {t('downloadInvoice')}
            </Button>
          )}
        </Flex>
      }
      styles={{
        body: {
          padding: 0,
          maxHeight: '70vh',
          overflowY: 'auto',
        },
      }}
      closeIcon={<CloseOutlined />}
    >
      <div
        ref={printRef}
        style={{
          padding: 40,
          backgroundColor: colors.background,
          minHeight: 600,
          borderLeft: templateStyle === 'modern' ? `6px solid ${colors.primary}` : undefined,
        }}
      >
        {/* Invoice Header */}
        <Row justify="space-between" align="top" style={{ marginBottom: 40 }}>
          <Col>
            <Flex align="center" gap={12} style={{ marginBottom: 12 }}>
              {showLogo && (organizationLogo ? (
                <img src={organizationLogo} alt="Logo" style={{ height: 48, width: 'auto' }} />
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    background: `linear-gradient(135deg, ${colors.primary} 0%, ${token.colorPrimaryActive} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 20,
                  }}
                >
                  {organizationName.charAt(0).toUpperCase()}
                </div>
              ))}
              <Title level={4} style={{ margin: 0, fontSize: 16, color: colors.primary }}>
                {organizationName}
              </Title>
              <Tooltip title={t('companyDetailsTooltip')}>
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={handleEditCompanyDetails}
                  style={{ marginLeft: 8 }}
                />
              </Tooltip>
            </Flex>
            <Text type="secondary" style={{ display: 'block' }}>
              {organizationEmail || (
                <Text type="secondary" italic>
                  No email set
                </Text>
              )}
            </Text>
            {organizationPhone && (
              <Text type="secondary" style={{ display: 'block' }}>
                {organizationPhone}
              </Text>
            )}
            {organizationAddressLine1 && (
              <Text type="secondary" style={{ display: 'block' }}>
                {organizationAddressLine1}
              </Text>
            )}
            {organizationAddressLine2 && (
              <Text type="secondary" style={{ display: 'block' }}>
                {organizationAddressLine2}
              </Text>
            )}
            {organizationCityStateZip && (
              <Text type="secondary" style={{ display: 'block' }}>
                {organizationCityStateZip}
              </Text>
            )}
            {organizationCountry && (
              <Text type="secondary" style={{ display: 'block' }}>
                {organizationCountry}
              </Text>
            )}
          </Col>
          <Col style={{ textAlign: 'right' }}>
            <Title
              level={2}
              className="invoices-preview-title"
              style={
                templateStyle === 'modern'
                  ? { margin: 0, color: colors.primary, fontWeight: 700, letterSpacing: 0 }
                  : { margin: 0, color: colors.text }
              }
            >
              {t('invoiceTitle').toUpperCase()}
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              #{invoice.invoiceNumber}
            </Text>
            <div style={{ marginTop: 8 }}>
              <span
                className="status-badge"
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  backgroundColor:
                    paymentStatus === 'paid'
                      ? isDark
                        ? 'rgba(82, 196, 26, 0.15)'
                        : '#f6ffed'
                      : paymentStatus === 'partially_paid'
                        ? isDark
                          ? 'rgba(250, 173, 20, 0.15)'
                          : '#fff7e6'
                        : isDark
                          ? 'rgba(255, 77, 79, 0.15)'
                          : '#fff2f0',
                  color:
                    paymentStatus === 'paid'
                      ? colors.success
                      : paymentStatus === 'partially_paid'
                        ? colors.warning
                        : colors.error,
                }}
              >
                {getStatusText(paymentStatus)}
              </span>
            </div>
          </Col>
        </Row>

        {/* Invoice Meta */}
        <Row
          gutter={24}
          style={{
            marginBottom: 40,
            padding: 24,
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 8,
          }}
        >
          <Col xs={24} sm={12}>
            <Text
              type="secondary"
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {t('billedTo')}
            </Text>
            <div style={{ marginTop: 8 }}>
              <Text strong style={{ fontSize: 14, display: 'block' }}>
                {invoice.client?.name || '-'}
              </Text>
              {invoice.client?.companyName && (
                <Text style={{ display: 'block' }}>{invoice.client.companyName}</Text>
              )}
              {invoice.client?.address && (
                <Text type="secondary" style={{ display: 'block' }}>
                  {invoice.client.address}
                </Text>
              )}
              {invoice.client?.email && (
                <Text type="secondary" style={{ display: 'block' }}>
                  {invoice.client.email}
                </Text>
              )}
              {invoice.client?.phone && (
                <Text type="secondary" style={{ display: 'block' }}>
                  {invoice.client.phone}
                </Text>
              )}
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {t('invoiceDate')}
                </Text>
                <div style={{ marginTop: 4 }}>
                  <Text strong>{formatDate(invoice.createdAt)}</Text>
                </div>
              </Col>
              <Col span={12}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {t('dueDateLabel')}
                </Text>
                <div style={{ marginTop: 4 }}>
                  <Text strong type={isOverdue ? 'danger' : undefined}>
                    {formatDate(invoice.dueDate)}
                  </Text>
                </div>
              </Col>
              <Col span={12}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {t('reference')}
                </Text>
                <div style={{ marginTop: 4 }}>
                  <Text strong>{invoice.request?.requestNumber || '-'}</Text>
                </div>
              </Col>
              <Col span={12}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {t('total')}
                </Text>
                <div style={{ marginTop: 4 }}>
                  <Text strong style={{ fontSize: 14, color: colors.primary }}>
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </Text>
                </div>
              </Col>
            </Row>
          </Col>
        </Row>

        {/* Line Items Table */}
        <Table
          dataSource={lineItems}
          columns={columns}
          pagination={false}
          size="small"
          bordered={templateStyle === 'classic'}
          style={{ marginBottom: 24 }}
        />

        {/* Totals */}
        <Row justify="end">
          <Col xs={24} sm={12} md={8}>
            <Flex justify="space-between" style={{ padding: '8px 0' }}>
              <Text type="secondary">{t('subtotal')}</Text>
              <Text>{formatCurrency(invoice.subtotal || invoice.amount, invoice.currency)}</Text>
            </Flex>
            {invoice.discountAmount && invoice.discountAmount > 0 && (
              <Flex justify="space-between" style={{ padding: '8px 0' }}>
                <Text type="secondary">
                  {t('discount')} (
                  {invoice.discountType === 'percentage'
                    ? `${invoice.discountValue}%`
                    : formatCurrency(invoice.discountValue || 0, invoice.currency)}
                  )
                </Text>
                <Text type="success">
                  -{formatCurrency(invoice.discountAmount, invoice.currency)}
                </Text>
              </Flex>
            )}
            {invoice.taxAmount && invoice.taxAmount > 0 && (
              <Flex justify="space-between" style={{ padding: '8px 0' }}>
                <Text type="secondary">
                  {t('tax')} ({invoice.taxRate || 0}%)
                </Text>
                <Text>{formatCurrency(invoice.taxAmount, invoice.currency)}</Text>
              </Flex>
            )}
            <Divider style={{ margin: '12px 0' }} />
            <Flex justify="space-between" style={{ padding: '8px 0' }}>
              <Text strong style={{ fontSize: 14 }}>
                {t('total')}
              </Text>
              <Text strong style={{ fontSize: 14, color: colors.primary }}>
                {formatCurrency(invoice.amount, invoice.currency)}
              </Text>
            </Flex>
          </Col>
        </Row>

        {/* Notes */}
        {invoice.notes && (
          <div
            style={{
              marginTop: 40,
              padding: 20,
              backgroundColor: colors.backgroundSecondary,
              borderRadius: 8,
            }}
          >
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('notes')}
            </Text>
            <Text type="secondary">{invoice.notes}</Text>
          </div>
        )}

        {/* Footer */}
        {invoiceFooterMessage && (
          <div
            style={{
              marginTop: 60,
              textAlign: 'center',
              paddingTop: 20,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {invoiceFooterMessage}
            </Text>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InvoicePreviewModal;
