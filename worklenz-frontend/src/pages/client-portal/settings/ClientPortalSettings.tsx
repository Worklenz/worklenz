import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Spin, Flex, Typography, message, theme } from '@/shared/antd-imports';
import {
  BankOutlined,
  BgColorsOutlined,
  FileTextOutlined,
  EyeOutlined,
  BellOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  TagsOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  MixpanelEvents,
  ClientPortalEventProps,
  ClientPortalActionEventProps,
} from '@/types/mixpanel-events.types';
import {
  CLIENT_PORTAL_SETTINGS_DEFAULTS,
  IClientPortalSettings,
} from '@/types/settings/client-portal-settings.types';
import { CompanyDetailsSection } from './sections/CompanyDetailsSection';
import { BrandingSection } from './sections/BrandingSection';
import { InvoiceTemplateSection } from './sections/InvoiceTemplateSection';
import { VisibilitySection } from './sections/VisibilitySection';
import { NotificationsSection } from './sections/NotificationsSection';
import { ClientUserManagementSection } from './sections/ClientUserManagementSection';
import { PermissionTemplatesSection } from './sections/PermissionTemplatesSection';
import { TicketingConfigSection } from './sections/TicketingConfigSection';

type SectionKey =
  | 'company'
  | 'branding'
  | 'invoiceTemplate'
  | 'visibility'
  | 'notifications'
  | 'clientUsers'
  | 'templates'
  | 'ticketing';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const ClientPortalSettings = () => {
  const { t } = useTranslation('client-portal-settings');
  const { token } = theme.useToken();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [section, setSection] = useState<SectionKey>('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<IClientPortalSettings>(CLIENT_PORTAL_SETTINGS_DEFAULTS);
  const [originalSettings, setOriginalSettings] = useState<IClientPortalSettings>(
    CLIENT_PORTAL_SETTINGS_DEFAULTS
  );

  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [organizationLogo, setOrganizationLogo] = useState<string | null>(null);
  const [isLogoSynced, setIsLogoSynced] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoUrl, setPendingLogoUrl] = useState<string | null>(null);
  const [pendingLogoRemoval, setPendingLogoRemoval] = useState(false);

  const SECTIONS: { key: SectionKey; icon: React.ReactNode; labelKey: string; labelDefault: string }[] = [
    { key: 'company', icon: <BankOutlined />, labelKey: 'navCompanyDetails', labelDefault: 'Company Details' },
    { key: 'branding', icon: <BgColorsOutlined />, labelKey: 'navBranding', labelDefault: 'Branding' },
    { key: 'invoiceTemplate', icon: <FileTextOutlined />, labelKey: 'navInvoiceTemplate', labelDefault: 'Invoice Template' },
    { key: 'visibility', icon: <EyeOutlined />, labelKey: 'navVisibility', labelDefault: 'Client Visible Selection' },
    { key: 'notifications', icon: <BellOutlined />, labelKey: 'navNotifications', labelDefault: 'Notifications' },
    { key: 'clientUsers', icon: <TeamOutlined />, labelKey: 'navClientUsers', labelDefault: 'Client User Management' },
    { key: 'templates', icon: <SafetyCertificateOutlined />, labelKey: 'navTemplates', labelDefault: 'Permission Templates' },
    { key: 'ticketing', icon: <TagsOutlined />, labelKey: 'navTicketing', labelDefault: 'Ticketing Config' },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const pageEventProps: ClientPortalEventProps = {
      page: 'settings',
      section: 'client_portal',
      source: 'direct_visit',
    };
    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_SETTINGS_VIEWED, pageEventProps);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    return () => {
      if (pendingLogoUrl) URL.revokeObjectURL(pendingLogoUrl);
    };
  }, [pendingLogoUrl]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await profileSettingsApiService.getClientPortalSettings();
      if (response.done && response.body) {
        const merged: IClientPortalSettings = { ...CLIENT_PORTAL_SETTINGS_DEFAULTS, ...response.body };
        setSettings(merged);
        setOriginalSettings(merged);
        setCustomLogo(response.body.logo_url || null);
        setOrganizationLogo(response.body.organization_logo_url || null);
        setIsLogoSynced(response.body.is_logo_synced || false);
      }
    } catch (error) {
      console.error('Failed to load client portal settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsChange = (patch: Partial<IClientPortalSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  };

  const handleLogoFileSelected = (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error(t('invalidLogoFileTypeError', { defaultValue: 'Please select an image file.' }));
      return;
    }
    if (file.size / 1024 / 1024 >= 2) {
      message.error(t('logoFileTooLargeError', { defaultValue: 'Logo must be smaller than 2MB.' }));
      return;
    }
    if (pendingLogoUrl) URL.revokeObjectURL(pendingLogoUrl);
    setPendingLogoFile(file);
    setPendingLogoUrl(URL.createObjectURL(file));
    setPendingLogoRemoval(false);
  };

  const handleStageLogoRemoval = () => {
    const actionProps: ClientPortalActionEventProps = {
      action_type: 'delete',
      item_type: 'settings',
      page: 'settings',
      section: 'client_portal',
      source: 'remove_logo_button',
    };
    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_LOGO_REMOVED, actionProps);

    if (pendingLogoUrl) URL.revokeObjectURL(pendingLogoUrl);
    setPendingLogoFile(null);
    setPendingLogoUrl(null);
    setPendingLogoRemoval(true);
  };

  const handleCancelLogoRemoval = () => setPendingLogoRemoval(false);

  const handleUseOrganizationLogo = async () => {
    try {
      setSaving(true);
      const response = await profileSettingsApiService.updateClientPortalSettings({ logo_url: null });
      if (response.done) {
        setCustomLogo(null);
        setIsLogoSynced(true);
      }
    } catch (error) {
      console.error('Failed to reset to organization logo:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetPendingLogoState = () => {
    if (pendingLogoUrl) URL.revokeObjectURL(pendingLogoUrl);
    setPendingLogoFile(null);
    setPendingLogoUrl(null);
    setPendingLogoRemoval(false);
  };

  const hasUnsavedChanges = useMemo(
    () =>
      JSON.stringify(settings) !== JSON.stringify(originalSettings) ||
      Boolean(pendingLogoFile) ||
      pendingLogoRemoval,
    [settings, originalSettings, pendingLogoFile, pendingLogoRemoval]
  );

  const handleCancelChanges = () => {
    setSettings(originalSettings);
    resetPendingLogoState();
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      let logoUrl = settings.logo_url;

      if (pendingLogoFile) {
        const base64 = await fileToBase64(pendingLogoFile);
        const uploadResponse = await profileSettingsApiService.uploadClientPortalLogo(base64);
        if (!uploadResponse.done || !uploadResponse.body?.logo_url) {
          message.error(t('logoUploadFailedError', { defaultValue: 'Failed to upload logo.' }));
          setSaving(false);
          return;
        }
        logoUrl = uploadResponse.body.logo_url;
        setCustomLogo(`${logoUrl}?t=${Date.now()}`);
        setIsLogoSynced(false);

        const uploadProps: ClientPortalActionEventProps = {
          action_type: 'create',
          item_type: 'settings',
          page: 'settings',
          section: 'client_portal',
          source: 'save_changes_button',
        };
        trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_LOGO_UPLOADED, uploadProps);
      } else if (pendingLogoRemoval) {
        logoUrl = null;
        setCustomLogo(null);
      }

      const response = await profileSettingsApiService.updateClientPortalSettings({
        ...settings,
        logo_url: logoUrl,
      });

      if (response.done) {
        const saved = { ...settings, logo_url: logoUrl };
        setSettings(saved);
        setOriginalSettings(saved);
        resetPendingLogoState();
        message.success(t('settingsSavedText', { defaultValue: 'Settings saved successfully' }));

        const saveProps: ClientPortalActionEventProps = {
          action_type: 'edit',
          item_type: 'settings',
          page: 'settings',
          section: 'client_portal',
          source: 'save_changes_button',
          success: true,
        };
        trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_SETTINGS_SAVED, saveProps);
      } else {
        message.error(t('settingsSaveFailedError', { defaultValue: 'Failed to save settings.' }));
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      message.error(t('settingsSaveFailedError', { defaultValue: 'Failed to save settings.' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" style={{ height: 'calc(100vh - 200px)' }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0, fontSize: 22 }}>
          {t('title', { defaultValue: 'Portal Settings' })}
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t('customizePortalText', { defaultValue: 'Customize your client portal appearance and branding' })}
        </Typography.Text>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: 220, flexShrink: 0 }}>
          {SECTIONS.map(item => {
            const active = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  marginBottom: 4,
                  border: 'none',
                  borderLeft: active ? `3px solid ${token.colorPrimary}` : '3px solid transparent',
                  cursor: 'pointer',
                  background: active ? token.colorPrimaryBg : 'transparent',
                  fontSize: 13.5,
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = token.colorBgTextHover;
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <span style={{ display: 'inline-flex', color: active ? token.colorPrimary : token.colorTextSecondary }}>
                  {item.icon}
                </span>
                <span style={{ color: active ? token.colorPrimary : token.colorText, fontWeight: active ? 600 : 400 }}>
                  {t(item.labelKey, { defaultValue: item.labelDefault })}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: '1 1 480px', minWidth: 0 }}>
          {section === 'company' && (
            <CompanyDetailsSection settings={settings} onChange={handleSettingsChange} />
          )}
          {section === 'branding' && (
            <BrandingSection
              settings={settings}
              onChange={handleSettingsChange}
              customLogo={customLogo}
              organizationLogo={organizationLogo}
              isLogoSynced={isLogoSynced}
              pendingLogoUrl={pendingLogoUrl}
              pendingLogoRemoval={pendingLogoRemoval}
              saving={saving}
              onLogoFileSelected={handleLogoFileSelected}
              onStageLogoRemoval={handleStageLogoRemoval}
              onCancelLogoRemoval={handleCancelLogoRemoval}
              onUseOrganizationLogo={handleUseOrganizationLogo}
            />
          )}
          {section === 'invoiceTemplate' && (
            <InvoiceTemplateSection settings={settings} onChange={handleSettingsChange} />
          )}
          {section === 'visibility' && (
            <VisibilitySection settings={settings} onChange={handleSettingsChange} />
          )}
          {section === 'notifications' && (
            <NotificationsSection settings={settings} onChange={handleSettingsChange} />
          )}
          {section === 'clientUsers' && (
            <ClientUserManagementSection settings={settings} onChange={handleSettingsChange} />
          )}
          {section === 'templates' && <PermissionTemplatesSection />}
          {section === 'ticketing' && <TicketingConfigSection />}

          {hasUnsavedChanges && (
            <Flex justify="flex-start" gap={8} style={{ marginTop: 20 }}>
              <Button size="small" icon={<CloseOutlined />} onClick={handleCancelChanges} disabled={saving}>
                {t('cancelButton', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSaveChanges}
                loading={saving}
              >
                {t('saveButton', { defaultValue: 'Save Changes' })}
              </Button>
            </Flex>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientPortalSettings;
