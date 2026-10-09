import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Input, theme } from '@/shared/antd-imports';
import { InfoCircleOutlined } from '@ant-design/icons';
import { IClientPortalSettings } from '@/types/settings/client-portal-settings.types';
import { SectionCard } from './SectionCard';
import { SettingsToggleRow } from './SettingsToggleRow';

interface InvoiceTemplateSectionProps {
  settings: IClientPortalSettings;
  onChange: (patch: Partial<IClientPortalSettings>) => void;
}

/** A lightweight client-side mock — visually representative of, but independent from, the real
 * invoice renderers (backend PDF generator + the on-screen preview modal), same as Branding's
 * preview card is a mock of the real client portal rather than an embed of it. */
const InvoicePreviewMock: React.FC<{
  color: string;
  showLogo: boolean;
  footerMessage: string | null;
}> = ({ color, showLogo, footerMessage }) => {
  const { token } = theme.useToken();
  const sampleRows = [
    { desc: 'Design services', amount: '$1,200.00' },
    { desc: 'Development hours', amount: '$800.00' },
  ];

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 8,
        padding: 16,
        background: token.colorBgContainer,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: `2px solid ${color}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {showLogo && (
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: color,
              }}
            />
          )}
          <span style={{ fontSize: 12, fontWeight: 600 }}>Your Company</span>
        </div>
        <span style={{ fontSize: 16, fontWeight: 300, color: token.colorText }}>INVOICE</span>
      </div>
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                fontWeight: 600,
                color: token.colorTextSecondary,
                paddingBottom: 6,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              Description
            </th>
            <th
              style={{
                textAlign: 'right',
                fontWeight: 600,
                color: token.colorTextSecondary,
                paddingBottom: 6,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {sampleRows.map(row => (
            <tr key={row.desc}>
              <td style={{ padding: '6px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                {row.desc}
              </td>
              <td
                style={{
                  padding: '6px 0',
                  textAlign: 'right',
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                {row.amount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>Total: $2,000.00</span>
      </div>
      {footerMessage && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            textAlign: 'center',
            fontSize: 11,
            color: token.colorTextSecondary,
          }}
        >
          {footerMessage}
        </div>
      )}
    </div>
  );
};

export const InvoiceTemplateSection: React.FC<InvoiceTemplateSectionProps> = ({ settings, onChange }) => {
  const { t } = useTranslation('client-portal-settings');
  const { token } = theme.useToken();
  const brandColor = settings.primary_color || '#1677ff';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 340px)', gap: 20 }}>
      <SectionCard
        title={t('invoiceTemplateTitle', { defaultValue: 'Invoice Template' })}
        description={t('invoiceTemplateDescription', {
          defaultValue: 'Choose how invoices look when downloaded or previewed by your team and clients.',
        })}
      >
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message={t('invoiceMoreCustomizationTitle', { defaultValue: 'More customization coming soon' })}
          description={t('invoiceMoreCustomizationDescription', {
            defaultValue: 'Additional layout and design options for your invoice template are on the way.',
          })}
          style={{ marginBottom: 20 }}
        />

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {t('invoiceAccentColorLabel', { defaultValue: 'Accent Color' })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: brandColor,
                boxShadow: `0 0 0 1px ${token.colorBorderSecondary}`,
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {t('invoiceAccentColorHint', { defaultValue: 'Uses your Brand Color from Branding.' })}
            </span>
          </div>
        </div>

        <SettingsToggleRow
          label={t('invoiceShowLogoLabel', { defaultValue: 'Show Company Logo on Invoice' })}
          description={t('invoiceShowLogoDescription', {
            defaultValue: 'Display your portal logo in the invoice header.',
          })}
          checked={settings.invoice_show_logo}
          onChange={checked => onChange({ invoice_show_logo: checked })}
        />

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {t('invoiceFooterLabel', { defaultValue: 'Invoice Footer Message' })}
          </div>
          <Input
            placeholder={t('invoiceFooterPlaceholder', { defaultValue: 'e.g., Thank you for your business!' })}
            value={settings.invoice_footer_message || ''}
            onChange={e => onChange({ invoice_footer_message: e.target.value })}
          />
        </div>
      </SectionCard>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: token.colorTextSecondary, marginBottom: 8 }}>
          {t('invoicePreviewLabel', { defaultValue: 'Preview' })}
        </div>
        <InvoicePreviewMock
          color={brandColor}
          showLogo={settings.invoice_show_logo}
          footerMessage={settings.invoice_footer_message}
        />
      </div>
    </div>
  );
};

export default InvoiceTemplateSection;
