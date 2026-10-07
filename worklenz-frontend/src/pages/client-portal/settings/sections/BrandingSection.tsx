import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ColorPicker, Flex, Tag, Typography, theme } from '@/shared/antd-imports';
import {
  UploadOutlined,
  DeleteOutlined,
  PictureOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/styles/colors';
import {
  CLIENT_PORTAL_BRAND_COLORS,
  IClientPortalSettings,
} from '@/types/settings/client-portal-settings.types';
import { SectionCard } from './SectionCard';

interface BrandingSectionProps {
  settings: IClientPortalSettings;
  onChange: (patch: Partial<IClientPortalSettings>) => void;
  customLogo: string | null;
  organizationLogo: string | null;
  isLogoSynced: boolean;
  pendingLogoUrl: string | null;
  pendingLogoRemoval: boolean;
  saving: boolean;
  onLogoFileSelected: (file: File) => void;
  onStageLogoRemoval: () => void;
  onCancelLogoRemoval: () => void;
  onUseOrganizationLogo: () => void;
}

export const BrandingSection: React.FC<BrandingSectionProps> = ({
  settings,
  onChange,
  customLogo,
  organizationLogo,
  isLogoSynced,
  pendingLogoUrl,
  pendingLogoRemoval,
  saving,
  onLogoFileSelected,
  onStageLogoRemoval,
  onCancelLogoRemoval,
  onUseOrganizationLogo,
}) => {
  const { t } = useTranslation('client-portal-settings');
  const { token } = theme.useToken();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewLogo = pendingLogoUrl || customLogo || organizationLogo || null;
  const isDarkPreview = settings.portal_theme === 'dark';
  const brandColor = settings.primary_color || CLIENT_PORTAL_BRAND_COLORS[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 380px)', gap: 20 }}>
      <SectionCard title={t('brandingTitle', { defaultValue: 'Branding' })}>
        {/* Logo */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {t('portalLogoLabel', { defaultValue: 'Portal Logo' })}
          </div>
          <div
            onClick={!pendingLogoRemoval && !previewLogo ? () => fileInputRef.current?.click() : undefined}
            style={{
              border: `1px dashed ${pendingLogoUrl ? token.colorPrimary : pendingLogoRemoval ? token.colorError : token.colorBorderSecondary}`,
              borderRadius: 8,
              padding: '18px 12px',
              textAlign: 'center',
              cursor: !pendingLogoRemoval && !previewLogo ? 'pointer' : 'default',
            }}
          >
            {pendingLogoRemoval ? (
              <Flex vertical gap={4} align="center">
                <Typography.Text strong style={{ fontSize: 13 }}>
                  {t('logoWillBeRemovedText', { defaultValue: 'This logo will be removed' })}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                  {organizationLogo
                    ? t('afterRemovalOrgLogoText', { defaultValue: 'The organization logo will be used instead.' })
                    : t('noLogoWillBeDisplayedText', { defaultValue: 'No logo will be displayed.' })}
                </Typography.Text>
              </Flex>
            ) : previewLogo ? (
              <Flex vertical gap={10} align="center">
                <img
                  src={previewLogo}
                  alt={t('logoAlt', { defaultValue: 'Logo' })}
                  style={{ maxWidth: 180, maxHeight: 72, objectFit: 'contain' }}
                />
                {pendingLogoUrl && (
                  <Tag color="blue" icon={<UploadOutlined />}>
                    {t('newLogoPendingTag', { defaultValue: 'New logo pending' })}
                  </Tag>
                )}
                {isLogoSynced && organizationLogo && !customLogo && !pendingLogoUrl && (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    {t('fromOrganizationTag', { defaultValue: 'From organization' })}
                  </Tag>
                )}
              </Flex>
            ) : (
              <Flex vertical gap={4} align="center">
                <PictureOutlined style={{ fontSize: 24, color: colors.lightGray }} />
                <Typography.Text style={{ fontSize: 13, fontWeight: 600 }}>
                  {t('noLogoUploadedText', { defaultValue: 'No logo uploaded' })}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                  {t('clickToUploadLogoText', { defaultValue: 'Click to upload a logo for your client portal' })}
                </Typography.Text>
              </Flex>
            )}
          </div>

          <Flex gap={8} wrap="wrap" style={{ marginTop: 10 }}>
            {pendingLogoRemoval ? (
              <Button size="small" onClick={onCancelLogoRemoval}>
                {t('cancelButton', { defaultValue: 'Cancel' })}
              </Button>
            ) : (
              <>
                <Button size="small" icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
                  {previewLogo
                    ? t('changeLogoButton', { defaultValue: 'Change Logo' })
                    : t('uploadLogoButton', { defaultValue: 'Upload Logo' })}
                </Button>
                {customLogo && !isLogoSynced && (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={onStageLogoRemoval}>
                    {t('removeLogoButton', { defaultValue: 'Remove' })}
                  </Button>
                )}
                {isLogoSynced && organizationLogo && (
                  <Button size="small" loading={saving} onClick={onUseOrganizationLogo}>
                    {t('useCustomLogoInsteadButton', { defaultValue: 'Use Custom Logo' })}
                  </Button>
                )}
              </>
            )}
          </Flex>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files && e.target.files[0]) onLogoFileSelected(e.target.files[0]);
            }}
          />

          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: token.colorPrimary, userSelect: 'none' }}>
              {t('logoGuidelinesSummaryText', { defaultValue: 'Logo guidelines' })}
            </summary>
            <ul style={{ fontSize: 11.5, color: token.colorTextSecondary, margin: '6px 0 0', paddingLeft: 18 }}>
              <li>{t('recommendedSizeText', { defaultValue: 'Recommended size: 250x100 pixels' })}</li>
              <li>{t('maxFileSizeText', { defaultValue: 'Maximum file size: 2MB' })}</li>
              <li>{t('supportedFormatsText', { defaultValue: 'Supported formats: PNG, JPG, WEBP' })}</li>
            </ul>
          </details>
        </div>

        {/* Portal Title */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {t('portalTitleLabel', { defaultValue: 'Portal Title' })}
          </div>
          <input
            value={settings.portal_title || ''}
            onChange={e => onChange({ portal_title: e.target.value })}
            placeholder={t('portalTitlePlaceholder', { defaultValue: 'e.g., Acme Client Hub' })}
            style={{
              width: '100%',
              height: 36,
              borderRadius: 6,
              border: `1px solid ${token.colorBorder}`,
              background: token.colorBgContainer,
              color: token.colorText,
              padding: '0 12px',
              fontSize: 13,
            }}
          />
        </div>

        {/* Brand Color — same ColorPicker used by Project Settings' Project Color field */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {t('brandColorLabel', { defaultValue: 'Brand Color' })}
          </div>
          <ColorPicker
            value={brandColor}
            onChange={value => onChange({ primary_color: value.toHexString() })}
            disabledAlpha
            presets={[
              {
                label: t('recommendedColorsLabel', { defaultValue: 'Recommended' }),
                colors: CLIENT_PORTAL_BRAND_COLORS,
              },
            ]}
          />
        </div>

        {/* Theme */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {t('portalThemeLabel', { defaultValue: 'Theme' })}
          </div>
          <Flex gap={8}>
            <Button
              size="small"
              type={settings.portal_theme === 'light' ? 'primary' : 'default'}
              onClick={() => onChange({ portal_theme: 'light' })}
            >
              {t('lightPortalButton', { defaultValue: 'Light portal' })}
            </Button>
            <Button
              size="small"
              type={settings.portal_theme === 'dark' ? 'primary' : 'default'}
              onClick={() => onChange({ portal_theme: 'dark' })}
            >
              {t('darkPortalButton', { defaultValue: 'Dark portal' })}
            </Button>
          </Flex>
        </div>
      </SectionCard>

      {/* Live preview — pure local draft state, no save/reload needed to see it update. */}
      <div
        style={{
          border: `2px solid ${token.colorBorderSecondary}`,
          borderRadius: 12,
          overflow: 'hidden',
          height: 'fit-content',
        }}
      >
        <div
          style={{
            background: brandColor,
            padding: '16px 18px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {previewLogo && (
            <img
              src={previewLogo}
              alt=""
              style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4, background: '#fff', padding: 2 }}
            />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {settings.portal_title || t('defaultPortalTitlePreview', { defaultValue: 'Client Portal' })}
            </div>
            <div style={{ opacity: 0.85, fontSize: 12 }}>
              {t('previewWelcomeText', { defaultValue: 'Welcome back' })}
            </div>
          </div>
        </div>
        <div style={{ padding: 16, background: isDarkPreview ? '#141414' : '#fff' }}>
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: isDarkPreview ? '#1f1f1f' : '#f5f5f5',
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: isDarkPreview ? '#fff' : '#000' }}>
              {t('previewLatestInvoiceText', { defaultValue: 'Latest invoice' })}
            </div>
            <div style={{ fontSize: 11, opacity: 0.55, color: isDarkPreview ? '#fff' : '#000' }}>
              {t('previewInvoiceSampleText', { defaultValue: 'USD 2,500.00 · due in 6 days' })}
            </div>
          </div>
          <button
            style={{
              padding: '7px 14px',
              borderRadius: 7,
              background: brandColor,
              color: '#fff',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'default',
            }}
          >
            {t('previewViewTasksButton', { defaultValue: 'View my tasks' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrandingSection;
