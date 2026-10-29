import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import { canUseFeature } from '@/utils/subscription-utils';
import { Alert, Button, Flex, Typography, message, theme } from '@/shared/antd-imports';
import {
  BankOutlined,
  BgColorsOutlined,
  FileTextOutlined,
  EyeOutlined,
  BellOutlined,
  TeamOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import {
  useGetPortalSettingsQuery,
  useSavePortalSettingsMutation,
} from '@/api/client-portal/portal-access-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useIsAdminSurfaceReadOnly } from '@/hooks/useIsAdminSurfaceReadOnly';
import {
  MixpanelEvents,
  ClientPortalEventProps,
  ClientPortalActionEventProps,
} from '@/types/mixpanel-events.types';
import {
  CLIENT_PORTAL_SETTINGS_DEFAULTS,
  IClientPortalSettings,
} from '@/types/settings/client-portal-settings.types';
import type { PortalSettingsV2 } from '@/types/client-portal/v2';
import { validatePhoneNumber } from '@/utils/validatePhoneNumber';
import { CompanyDetailsSection } from './sections/CompanyDetailsSection';
import { BrandingSection } from './sections/BrandingSection';
import { LogoCropModal } from './sections/LogoCropModal';
import { InvoiceTemplateSection } from './sections/InvoiceTemplateSection';
import { SharingVisibilitySection } from './sections/SharingVisibilitySection';
import { ClientRolesSection } from './sections/ClientRolesSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { PortalLoader } from '@/components/client-portal/v2';

type SectionKey =
  | 'company'
  | 'branding'
  | 'invoiceTemplate'
  | 'sharing'
  | 'roles'
  | 'notifications';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * These three values belong to the v2 Portal Settings API (Sharing & Visibility and Client Roles).
 * The older company/branding save must not send them, or it would write back whatever this page
 * loaded and could undo a v2 change made since.
 */
const toLegacyPayload = (
  settings: IClientPortalSettings,
  logoUrl: string | null
): Partial<IClientPortalSettings> => {
  const payload: Partial<IClientPortalSettings> = { ...settings, logo_url: logoUrl };
  delete payload.visible_invoices;
  delete payload.poc_can_add_users;
  delete payload.poc_can_remove_users;
  return payload;
};

/** The permission switches whose change the server writes to the audit log. */
const PERMISSION_SWITCHES: ((settings: PortalSettingsV2) => boolean)[] = [
  settings => settings.show_invoices,
  settings => settings.admins_can_invite_users,
  settings => settings.admins_can_remove_users,
];

const ClientPortalSettings = () => {
  const { t } = useTranslation('client-portal-settings');
  const { t: tV2 } = useTranslation('client-portal-v2-settings');
  const isReadOnly = useIsAdminSurfaceReadOnly();
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
  const [cropRawSrc, setCropRawSrc] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // v2 settings: the server copy comes from RTK Query, and `draftV2` holds the user's edits.
  // `null` means "no edits yet", so a background refetch can never overwrite typed changes.
  const {
    data: v2Response,
    isLoading: isV2Loading,
    isError: isV2Error,
    isFetching: isV2Fetching,
    refetch: refetchV2,
  } = useGetPortalSettingsQuery();
  const [savePortalSettings] = useSavePortalSettingsMutation();
  const savedV2 = v2Response?.body?.settings;
  const [draftV2, setDraftV2] = useState<PortalSettingsV2 | null>(null);
  const currentV2 = draftV2 ?? savedV2 ?? null;

  const SECTIONS: { key: SectionKey; icon: React.ReactNode; label: string }[] = [
    {
      key: 'company',
      icon: <BankOutlined />,
      label: t('navCompanyDetails', { defaultValue: 'Company Details' }),
    },
    {
      key: 'branding',
      icon: <BgColorsOutlined />,
      label: t('navBranding', { defaultValue: 'Branding' }),
    },
    {
      key: 'invoiceTemplate',
      icon: <FileTextOutlined />,
      label: t('navInvoiceTemplate', { defaultValue: 'Invoice Template' }),
    },
    {
      key: 'sharing',
      icon: <EyeOutlined />,
      label: tV2('nav.sharing', { defaultValue: 'Sharing & Visibility' }),
    },
    {
      key: 'roles',
      icon: <TeamOutlined />,
      label: tV2('nav.roles', { defaultValue: 'Client Roles' }),
    },
    {
      key: 'notifications',
      icon: <BellOutlined />,
      label: tV2('nav.notifications', { defaultValue: 'Notifications' }),
    },
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

  const handleV2Change = (patch: Partial<PortalSettingsV2>) => {
    if (!currentV2) return;
    setDraftV2({ ...currentV2, ...patch });
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
    const reader = new FileReader();
    reader.onload = () => {
      setCropRawSrc(reader.result as string);
      setIsCropModalOpen(true);
    };
    reader.onerror = () => {
      message.error(t('logoUploadFailedError', { defaultValue: 'Failed to upload logo.' }));
    };
    reader.readAsDataURL(file);
  };

  const handleCropDone = async (croppedBase64: string) => {
    try {
      const res = await fetch(croppedBase64);
      const blob = await res.blob();
      const croppedFile = new File([blob], 'logo-cropped.png', { type: 'image/png' });

      if (croppedFile.size / 1024 / 1024 >= 2) {
        message.error(t('logoFileTooLargeError', { defaultValue: 'Logo must be smaller than 2MB.' }));
        setIsCropModalOpen(false);
        setCropRawSrc(null);
        return;
      }

      if (pendingLogoUrl) URL.revokeObjectURL(pendingLogoUrl);
      setPendingLogoFile(croppedFile);
      setPendingLogoUrl(URL.createObjectURL(croppedFile));
      setPendingLogoRemoval(false);
      setIsCropModalOpen(false);
      setCropRawSrc(null);
    } catch (err) {
      console.error('Failed to process cropped logo', err);
      message.error(t('logoUploadFailedError', { defaultValue: 'Failed to upload logo.' }));
    }
  };

  const handleCropCancel = () => {
    setIsCropModalOpen(false);
    setCropRawSrc(null);
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
        message.success(t('settingsSavedText', { defaultValue: 'Settings saved successfully' }));
      }
    } catch (error) {
      console.error('Failed to reset to organization logo:', error);
      message.error(t('settingsSaveFailedError', { defaultValue: 'Failed to save settings.' }));
    } finally {
      setSaving(false);
    }
  };

  const resetPendingLogoState = () => {
    if (pendingLogoUrl) URL.revokeObjectURL(pendingLogoUrl);
    setPendingLogoFile(null);
    setPendingLogoUrl(null);
    setPendingLogoRemoval(false);
    setCropRawSrc(null);
    setIsCropModalOpen(false);
  };

  const hasLegacyChanges = useMemo(
    () =>
      JSON.stringify(settings) !== JSON.stringify(originalSettings) ||
      Boolean(pendingLogoFile) ||
      pendingLogoRemoval,
    [settings, originalSettings, pendingLogoFile, pendingLogoRemoval]
  );

  const hasV2Changes = useMemo(
    () => draftV2 !== null && JSON.stringify(draftV2) !== JSON.stringify(savedV2),
    [draftV2, savedV2]
  );

  const hasUnsavedChanges = hasLegacyChanges || hasV2Changes;

  const handleCancelChanges = () => {
    setSettings(originalSettings);
    setDraftV2(null);
    resetPendingLogoState();
  };

  /** Saves Company Details, Branding and Invoice Template through the original settings endpoint. */
  const saveLegacySettings = async (): Promise<boolean> => {
    let logoUrl = settings.logo_url;

    if (pendingLogoFile) {
      const base64 = await fileToBase64(pendingLogoFile);
      const uploadResponse = await profileSettingsApiService.uploadClientPortalLogo(base64);
      if (!uploadResponse.done || !uploadResponse.body?.logo_url) {
        message.error(t('logoUploadFailedError', { defaultValue: 'Failed to upload logo.' }));
        return false;
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

    const response = await profileSettingsApiService.updateClientPortalSettings(
      toLegacyPayload(settings, logoUrl)
    );
    if (!response.done) {
      message.error(t('settingsSaveFailedError', { defaultValue: 'Failed to save settings.' }));
      return false;
    }

    const saved = { ...settings, logo_url: logoUrl };
    setSettings(saved);
    setOriginalSettings(saved);
    resetPendingLogoState();
    return true;
  };

  /** Saves the v2 sections and tells the user which permission change was written to the audit log. */
  const saveV2Settings = async (): Promise<boolean> => {
    if (!draftV2 || !savedV2) return true;
    try {
      await savePortalSettings(draftV2).unwrap();
    } catch (error) {
      message.error(
        getPortalErrorMessage(
          error,
          tV2('saveFailed', { defaultValue: 'The portal settings could not be saved.' })
        )
      );
      return false;
    }

    const changed = PERMISSION_SWITCHES.filter(read => read(draftV2) !== read(savedV2));
    if (changed.length > 0) {
      message.info(
        tV2('auditRecorded', { defaultValue: 'Permission change recorded in the audit log.' })
      );
    }
    setDraftV2(null);
    return true;
  };

  const handleSaveChanges = async () => {
    if (settings.contact_phone && !validatePhoneNumber(settings.contact_phone)) {
      setSection('company');
      message.error(
        t('invalidPhoneNumberFormat', {
          defaultValue:
            'Invalid phone number format. Use international format (e.g., +1-234-567-8900)',
        })
      );
      return;
    }

    try {
      setSaving(true);
      if (hasLegacyChanges && !(await saveLegacySettings())) return;
      if (hasV2Changes && !(await saveV2Settings())) return;

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
    } catch (error) {
      console.error('Failed to save settings:', error);
      message.error(t('settingsSaveFailedError', { defaultValue: 'Failed to save settings.' }));
    } finally {
      setSaving(false);
    }
  };

  /** The rebuilt sections need the v2 settings; show loading and error states around them. */
  const renderV2Section = (render: (current: PortalSettingsV2) => React.ReactNode) => {
    if (currentV2) return render(currentV2);
    if (isV2Loading) return <PortalLoader />;
    return (
      <Alert
        type="error"
        showIcon
        message={
          isV2Error
            ? tV2('loadFailed', { defaultValue: 'The portal settings could not be loaded.' })
            : tV2('loadEmpty', { defaultValue: 'No portal settings were returned.' })
        }
        action={
          <Button size="small" onClick={() => refetchV2()} loading={isV2Fetching}>
            {tV2('retry', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" style={{ height: 'calc(100vh - 200px)' }}>
        <PortalLoader />
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
          {tV2('subtitle', {
            defaultValue:
              'Branding, what is shared by default, roles and notifications for your client portal.',
          })}
        </Typography.Text>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <nav
          aria-label={t('title', { defaultValue: 'Portal Settings' })}
          style={{ width: 220, flexShrink: 0 }}
        >
          {SECTIONS.map(item => {
            const active = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSection(item.key)}
                aria-current={active ? 'page' : undefined}
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
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div style={{ flex: '1 1 480px', minWidth: 0 }}>
          {section === 'company' && (
            <CompanyDetailsSection settings={settings} onChange={handleSettingsChange} />
          )}
          {section === 'branding' && !canBrand && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('brandingBusinessOnly', {
                defaultValue:
                  'Portal logo, colors and removing the Worklenz footer are available on the Business plan.',
              })}
            />
          )}
          {section === 'branding' && (
            <div
              style={canBrand ? undefined : { pointerEvents: 'none', opacity: 0.55 }}
              aria-disabled={!canBrand}
              // React 18 only forwards `inert` as a string attribute; it blocks keyboard focus too.
              {...(canBrand ? {} : { inert: '' as unknown as boolean })}
            >
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
            </div>
          )}
          {section === 'invoiceTemplate' && (
            <InvoiceTemplateSection settings={settings} onChange={handleSettingsChange} />
          )}
          {section === 'sharing' &&
            renderV2Section(current => (
              <SharingVisibilitySection
                settings={current}
                shared={v2Response?.body?.shared}
                onChange={handleV2Change}
              />
            ))}
          {section === 'roles' &&
            renderV2Section(current => <ClientRolesSection settings={current} onChange={handleV2Change} />)}
          {section === 'notifications' &&
            renderV2Section(current => <NotificationsSection settings={current} onChange={handleV2Change} />)}

          {hasUnsavedChanges && !isReadOnly && (
            <Flex
              justify="flex-start"
              gap={8}
              style={{
                position: 'sticky',
                bottom: 0,
                marginTop: 20,
                padding: '12px 0',
                background: token.colorBgLayout,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                zIndex: 1,
              }}
            >
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

      <LogoCropModal
        open={isCropModalOpen}
        imageSrc={cropRawSrc}
        aspect={1}
        onCancel={handleCropCancel}
        onCropComplete={handleCropDone}
      />
    </div>
  );
};

export default ClientPortalSettings;
