import {
  Card,
  Flex,
  Typography,
  Upload,
  UploadProps,
  Button,
  Spin,
  Divider,
  Space,
  Tag,
  Row,
  Col,
  Image,
  Tooltip,
  Alert,
  Form,
  Input,
  Tabs,
} from '@/shared/antd-imports';
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { validatePhoneNumber } from '@/utils/validatePhoneNumber';
import PhoneInput from '@/components/PhoneInput/PhoneInput';
import {
  InboxOutlined,
  DeleteOutlined,
  EyeOutlined,
  UploadOutlined,
  PictureOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  SaveOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { profileSettingsApiService } from '../../../../api/settings/profile/profile-settings.api.service';
import { colors } from '../../../../styles/colors';
import { useMixpanelTracking } from '../../../../hooks/useMixpanelTracking';
import {
  MixpanelEvents,
  ClientPortalEventProps,
  ClientPortalActionEventProps,
} from '../../../../types/mixpanel-events.types';

const ClientPortalSettings = () => {
  const { t } = useTranslation('client-portal-settings');
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [organizationLogo, setOrganizationLogo] = useState<string | null>(null);
  const [isLogoSynced, setIsLogoSynced] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoUrl, setPendingLogoUrl] = useState<string | null>(null);
  const [pendingLogoRemoval, setPendingLogoRemoval] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyDetails, setCompanyDetails] = useState({
    company_name: '',
    address_line_1: '',
    address_line_2: '',
    contact_email: '',
    contact_phone: '',
    invoice_footer_message: '',
  });
  const [originalCompanyDetails, setOriginalCompanyDetails] = useState({
    company_name: '',
    address_line_1: '',
    address_line_2: '',
    contact_email: '',
    contact_phone: '',
    invoice_footer_message: '',
  });

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
      if (pendingLogoUrl) {
        URL.revokeObjectURL(pendingLogoUrl);
      }
    };
  }, [pendingLogoUrl]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await profileSettingsApiService.getClientPortalSettings();
      if (response.done && response.body) {
        if (response.body.logo_url) {
          setCustomLogo(response.body.logo_url);
          setIsLogoSynced(false);
        } else {
          setCustomLogo(null);
        }
        if (response.body.organization_logo_url) {
          setOrganizationLogo(response.body.organization_logo_url);
        }
        setIsLogoSynced(response.body.is_logo_synced || false);
        const details = {
          company_name: response.body.company_name || '',
          address_line_1: response.body.address_line_1 || '',
          address_line_2: response.body.address_line_2 || '',
          contact_email: response.body.contact_email || '',
          contact_phone: response.body.contact_phone || '',
          invoice_footer_message: response.body.invoice_footer_message || '',
        };
        setCompanyDetails(details);
        setOriginalCompanyDetails(details);
      }
    } catch (error) {
      console.error('Failed to load client portal settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      return false;
    }

    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      return false;
    }

    const previewUrl = URL.createObjectURL(file);

    setPendingLogoFile(file);
    setPendingLogoUrl(previewUrl);
    setPendingLogoRemoval(false);
    setHasUnsavedChanges(true);

    return false;
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

    setPendingLogoRemoval(true);
    setPendingLogoFile(null);
    setPendingLogoUrl(null);
    setHasUnsavedChanges(true);
  };

  const handleCompanyDetailsChange = (field: string, value: string) => {
    setCompanyDetails(prev => ({ ...prev, [field]: value }));
    const newDetails = { ...companyDetails, [field]: value };
    const hasChanges = JSON.stringify(newDetails) !== JSON.stringify(originalCompanyDetails);
    if (hasChanges || pendingLogoFile || pendingLogoRemoval) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);

      if (pendingLogoFile) {
        const actionProps: ClientPortalActionEventProps = {
          action_type: 'create',
          item_type: 'settings',
          page: 'settings',
          section: 'client_portal',
          source: 'save_changes_button',
        };

        trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_LOGO_UPLOADED, actionProps);

        const reader = new FileReader();
        reader.onload = async e => {
          try {
            const base64String = e.target?.result as string;
            const response = await profileSettingsApiService.uploadClientPortalLogo(base64String);

            if (response.done && response.body?.logo_url) {
              const logoUrlWithCacheBuster = `${response.body.logo_url}?t=${Date.now()}`;
              setCustomLogo(logoUrlWithCacheBuster);
              setIsLogoSynced(false);
            }
          } catch (error) {
            console.error('Logo upload error:', error);
          } finally {
            resetPendingChanges();
            setSaving(false);
          }
        };
        reader.readAsDataURL(pendingLogoFile);
        return;
      } else if (pendingLogoRemoval) {
        const response = await profileSettingsApiService.updateClientPortalSettings({
          logo_url: null,
        });

        if (response.done) {
          const saveProps: ClientPortalActionEventProps = {
            action_type: 'edit',
            item_type: 'settings',
            page: 'settings',
            section: 'client_portal',
            source: 'save_changes_button',
            success: true,
          };

          trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_SETTINGS_SAVED, saveProps);

          setCustomLogo(null);
          resetPendingChanges();
        } else {
          console.error('Failed to remove logo');
        }
        setSaving(false);
        return;
      }

      const companyDetailsChanged =
        JSON.stringify(companyDetails) !== JSON.stringify(originalCompanyDetails);
      if (companyDetailsChanged) {
        const response = await profileSettingsApiService.updateClientPortalSettings({
          ...companyDetails,
        });

        if (response.done) {
          setOriginalCompanyDetails(companyDetails);
        }
      }

      if (!pendingLogoFile && !pendingLogoRemoval && !companyDetailsChanged) {
        resetPendingChanges();
      }

      setSaving(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaving(false);
    }
  };

  const handleCancelChanges = () => {
    resetPendingChanges();
    setCompanyDetails(originalCompanyDetails);
  };

  const resetPendingChanges = () => {
    setPendingLogoFile(null);
    setPendingLogoUrl(null);
    setPendingLogoRemoval(false);
    setHasUnsavedChanges(false);

    if (pendingLogoUrl) {
      URL.revokeObjectURL(pendingLogoUrl);
    }
  };

  const triggerFileInput = () => {
    if (!saving && !pendingLogoRemoval) {
      fileInputRef.current?.click();
    }
  };

  const props: UploadProps = {
    name: 'file',
    multiple: false,
    accept: 'image/*',
    beforeUpload: handleLogoSelect,
    showUploadList: false,
    onDrop(e: React.DragEvent<HTMLDivElement>) {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  const LogoPreview = () => (
        <Card
          title={
            <Flex align="center" gap={8}>
              <EyeOutlined />
              <span>{t('logoPreviewTitle', { defaultValue: 'Logo Preview' })}</span>
            </Flex>
          }
      size="small"
      style={{
        border: `1px solid ${colors.deepLightGray}`,
        backgroundColor: 'var(--ant-color-bg-container)',
      }}
    >
      <Flex vertical gap={16} align="center">
        <div
          style={{
            padding: '24px 32px',
            border: `1px solid ${colors.deepLightGray}`,
            borderRadius: '8px',
            backgroundColor: 'var(--ant-color-bg-layout)',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {pendingLogoUrl && !pendingLogoRemoval ? (
            <img
              src={pendingLogoUrl}
              alt={t('newClientPortalLogoAlt', { defaultValue: 'New client portal logo preview' })}
              style={{
                maxWidth: '200px',
                maxHeight: '80px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                border: '2px dashed #1890ff',
                borderRadius: '4px',
              }}
            />
          ) : pendingLogoRemoval ? (
            <Flex vertical gap={8} align="center">
              <PictureOutlined style={{ fontSize: '32px', color: colors.lightGray }} />
              <Typography.Text type="secondary">
                {organizationLogo ? t('organizationLogoWillBeUsedText', { defaultValue: 'Organization logo will be used' }) : t('noLogoUploadedText', { defaultValue: 'No custom logo uploaded' })}
              </Typography.Text>
              <Tag color="orange">{t('pendingRemovalTag', { defaultValue: 'Pending Removal' })}</Tag>
            </Flex>
          ) : customLogo ? (
            <img
              src={customLogo}
              alt={t('clientPortalLogoAlt', { defaultValue: 'Client portal logo' })}
              style={{
                maxWidth: '200px',
                maxHeight: '80px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
              }}
            />
          ) : (
            <Flex vertical gap={8} align="center">
              <PictureOutlined style={{ fontSize: '32px', color: colors.lightGray }} />
              <Typography.Text type="secondary">{t('noLogoUploadedText', { defaultValue: 'No custom logo uploaded' })}</Typography.Text>
            </Flex>
          )}
        </div>

        <Flex gap={8} wrap="wrap" justify="center">
          <Tag color="blue">{t('headerDisplayTag', { defaultValue: 'Header Display' })}</Tag>
          <Tag color="green">{t('responsiveTag', { defaultValue: 'Responsive' })}</Tag>
          <Tag color="orange">{t('autoScaledTag', { defaultValue: 'Auto Scaled' })}</Tag>
          {pendingLogoUrl && !pendingLogoRemoval && <Tag color="cyan">{t('pendingUploadTag', { defaultValue: 'Pending Upload' })}</Tag>}
          {pendingLogoRemoval && <Tag color="orange">{t('pendingRemovalTag', { defaultValue: 'Pending Removal' })}</Tag>}
        </Flex>
      </Flex>
    </Card>
  );

  if (loading) {
    return (
      <Flex justify="center" align="center" style={{ height: 'calc(100vh - 200px)' }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Flex vertical gap={4}>
          <Flex align="center" gap={12}>
            <SettingOutlined style={{ fontSize: 20 }} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('title', { defaultValue: 'Client Portal Settings' })}
            </Typography.Title>
          </Flex>
          <Typography.Text type="secondary">{t('customizePortalText', { defaultValue: 'Customize your client portal appearance and branding.' })}</Typography.Text>
        </Flex>

        {hasUnsavedChanges && (
          <Space size="middle">
            <Space>
              <ExclamationCircleOutlined style={{ color: '#faad14' }} />
               <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                 {t('pendingChangesText', { defaultValue: 'You have unsaved changes.' })}
               </Typography.Text>
            </Space>
            <Space>
              <Button onClick={handleCancelChanges} icon={<CloseOutlined />}>
                {t('cancelButton', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type="primary"
                onClick={handleSaveChanges}
                loading={saving}
                icon={<SaveOutlined />}
              >
                {saving ? t('savingText', { defaultValue: 'Saving...' }) : t('saveButton', { defaultValue: 'Save Changes' })}
              </Button>
            </Space>
          </Space>
        )}
      </Flex>

      <Tabs
        defaultActiveKey="logo"
        items={[
          {
            key: 'logo',
            label: (
              <Flex align="center" gap={8}>
                <UploadOutlined />
                <span>{t('logoManagementTitle', { defaultValue: 'Logo Management' })}</span>
              </Flex>
            ),
            children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={14}>
                  <Card
                     title={
                       <Flex align="center" gap={8}>
                         <PictureOutlined />
                         <span>{t('logoManagementTitle', { defaultValue: 'Logo Management' })}</span>
                       </Flex>
                     }
                    style={{ height: 'fit-content' }}
                  >
                    <Flex vertical gap={20}>
                      <div
                        onClick={
                          !pendingLogoRemoval && !pendingLogoUrl ? triggerFileInput : undefined
                        }
                        style={{
                          width: '100%',
                          minHeight: '180px',
                          border: pendingLogoUrl
                            ? `2px dashed #1890ff`
                            : pendingLogoRemoval
                              ? `2px dashed #ff4d4f`
                              : `2px dashed ${colors.deepLightGray}`,
                          borderRadius: '12px',
                          backgroundColor: 'var(--ant-color-bg-layout)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          cursor:
                            !pendingLogoRemoval && !pendingLogoUrl && !saving
                              ? 'pointer'
                              : 'default',
                          transition: 'all 0.2s ease',
                          padding: '24px',
                        }}
                        onMouseEnter={e => {
                          if (
                            !pendingLogoRemoval &&
                            !pendingLogoUrl &&
                            !saving &&
                            !(customLogo || organizationLogo)
                          ) {
                            e.currentTarget.style.borderColor = colors.skyBlue;
                            e.currentTarget.style.backgroundColor =
                              'var(--ant-color-fill-tertiary)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (
                            !pendingLogoRemoval &&
                            !pendingLogoUrl &&
                            !saving &&
                            !(customLogo || organizationLogo)
                          ) {
                            e.currentTarget.style.borderColor = colors.deepLightGray;
                            e.currentTarget.style.backgroundColor = 'var(--ant-color-bg-layout)';
                          }
                        }}
                      >
                        {saving && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: 'rgba(0,0,0,0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 1,
                              borderRadius: '12px',
                            }}
                          >
                            <Spin size="large" />
                          </div>
                        )}

                        {pendingLogoRemoval ? (
                          <Flex vertical gap={12} align="center">
                            <ExclamationCircleOutlined
                              style={{ fontSize: '48px', color: colors.red }}
                            />
                             <Typography.Text strong>{t('logoWillBeRemovedText', { defaultValue: 'This logo will be removed' })}</Typography.Text>
                             <Typography.Text
                               type="secondary"
                               style={{ fontSize: '12px', textAlign: 'center' }}
                             >
                               {organizationLogo
                                 ? t('afterRemovalOrgLogoText', { defaultValue: 'The organization logo will be used instead.' })
                                 : t('noLogoWillBeDisplayedText', { defaultValue: 'No logo will be displayed.' })}
                            </Typography.Text>
                          </Flex>
                        ) : pendingLogoUrl || customLogo || organizationLogo ? (
                          <Flex vertical gap={16} align="center" style={{ width: '100%' }}>
                            <img
                               src={pendingLogoUrl || customLogo || organizationLogo || ''}
                              alt={t('logoAlt', { defaultValue: 'Client portal logo' })}
                              style={{
                                maxWidth: '240px',
                                maxHeight: '120px',
                                objectFit: 'contain',
                                borderRadius: '8px',
                              }}
                            />
                            <Flex gap={8} align="center">
                               {pendingLogoUrl && (
                                 <Tag color="blue" icon={<UploadOutlined />}>
                                   {t('newLogoPendingTag', { defaultValue: 'New logo pending' })}
                                 </Tag>
                               )}
                               {isLogoSynced && organizationLogo && !customLogo && (
                                 <Tag color="green" icon={<CheckCircleOutlined />}>
                                   {t('fromOrganizationTag', { defaultValue: 'From organization' })}
                                 </Tag>
                               )}
                               {customLogo && !isLogoSynced && (
                                 <Tag color="orange" icon={<PictureOutlined />}>
                                   {t('customLogoTag', { defaultValue: 'Custom' })}
                                 </Tag>
                               )}
                            </Flex>
                          </Flex>
                        ) : (
                          <Flex vertical gap={12} align="center">
                            <div
                              style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--ant-color-fill-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <PictureOutlined
                                style={{ fontSize: '32px', color: colors.skyBlue }}
                              />
                            </div>
                             <Typography.Text strong style={{ fontSize: '16px' }}>
                               {organizationLogo ? t('usingOrganizationLogoText', { defaultValue: 'Using organization logo' }) : t('noLogoUploadedText2', { defaultValue: 'No logo uploaded' })}
                             </Typography.Text>
                             <Typography.Text
                               type="secondary"
                               style={{ fontSize: '12px', textAlign: 'center' }}
                             >
                               {organizationLogo
                                 ? t('syncedFromOrgSettingsShortText', { defaultValue: 'Synced from organization settings' })
                                 : t('clickToUploadLogoText', { defaultValue: 'Click to upload your logo' })}
                            </Typography.Text>
                          </Flex>
                        )}
                      </div>

                      <Flex gap={8} wrap="wrap">
                        {pendingLogoUrl && (
                          <Button
                            type="primary"
                            icon={<UploadOutlined />}
                            onClick={handleSaveChanges}
                            loading={saving}
                            block
                          >
                             {t('saveNewLogoButton', { defaultValue: 'Save New Logo' })}
                          </Button>
                        )}
                        {!pendingLogoUrl &&
                          !pendingLogoRemoval &&
                          (customLogo || organizationLogo) && (
                            <Flex gap={8} style={{ width: '100%' }}>
                              <Button
                                icon={<UploadOutlined />}
                                onClick={triggerFileInput}
                                disabled={saving}
                                style={{ flex: 1 }}
                              >
                                 {customLogo || organizationLogo ? t('changeLogoButton', { defaultValue: 'Change Logo' }) : t('uploadLogoButton', { defaultValue: 'Upload Logo' })}
                              </Button>
                              {customLogo && !isLogoSynced && (
                                <Button
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={handleStageLogoRemoval}
                                  disabled={saving}
                                  style={{ flex: 1 }}
                                >
                                   {t('removeLogoButton', { defaultValue: 'Remove' })}
                                </Button>
                              )}
                              {isLogoSynced && organizationLogo && (
                                <Button
                                  type="default"
                                  onClick={async () => {
                                    try {
                                      setSaving(true);
                                      const response =
                                        await profileSettingsApiService.updateClientPortalSettings({
                                          logo_url: null,
                                        });
                                      if (response.done) {
                                        setCustomLogo(null);
                                        setIsLogoSynced(true);
                                        await loadSettings();
                                      }
                                    } catch (error) {
                                      console.error('Failed to reset to organization logo:', error);
                                    } finally {
                                      setSaving(false);
                                    }
                                  }}
                                  loading={saving}
                                  style={{ flex: 1 }}
                                >
                                   {t('useCustomLogoInsteadButton', { defaultValue: 'Use Custom Logo' })}
                                </Button>
                              )}
                            </Flex>
                          )}
                        {pendingLogoRemoval && (
                          <Flex gap={8} style={{ width: '100%' }}>
                            <Button
                              type="primary"
                              onClick={handleSaveChanges}
                              loading={saving}
                              style={{ flex: 1 }}
                            >
                               {t('confirmRemovalButton', { defaultValue: 'Confirm Removal' })}
                            </Button>
                            <Button
                              onClick={() => {
                                setPendingLogoRemoval(false);
                                setHasUnsavedChanges(false);
                              }}
                              disabled={saving}
                              style={{ flex: 1 }}
                            >
                               {t('cancelButton', { defaultValue: 'Cancel' })}
                            </Button>
                          </Flex>
                        )}
                      </Flex>

                      {isLogoSynced && organizationLogo && !customLogo && (
                        <Alert
                          message={
                            <Flex align="center" gap={8}>
                               <CheckCircleOutlined />
                               <span>{t('usingOrganizationLogoText2', { defaultValue: 'Using organization logo' })}</span>
                            </Flex>
                          }
                          description={
                            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                               {t('syncedFromOrgSettingsText', { defaultValue: 'Synced from organization settings' })} {' '}
                              <Button
                                type="link"
                                size="small"
                                onClick={() =>
                                  window.open('/worklenz/admin-center/overview', '_blank')
                                }
                                style={{ padding: 0, height: 'auto', fontSize: '12px' }}
                              >
                                 {t('manageInAdminCenterText', { defaultValue: 'Manage in Admin Center' })}
                              </Button>
                            </Typography.Text>
                          }
                          type="info"
                          showIcon={false}
                          style={{ marginTop: 8 }}
                        />
                      )}

                      <details style={{ marginTop: 8 }}>
                        <summary
                          style={{
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: colors.skyBlue,
                            userSelect: 'none',
                          }}
                        >
                          <InfoCircleOutlined style={{ marginRight: 4 }} />
                           {t('logoGuidelinesSummaryText', { defaultValue: 'Logo guidelines' })}
                        </summary>
                        <div style={{ marginTop: 12, paddingLeft: 20 }}>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}
                          >
                             {t('recommendedSizeText', { defaultValue: 'Recommended size: 240 x 80 pixels' })}
                          </Typography.Text>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}
                          >
                             {t('maxFileSizeText', { defaultValue: 'Maximum file size: 2MB' })}
                          </Typography.Text>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}
                          >
                             {t('supportedFormatsText', { defaultValue: 'Supported formats: PNG, JPG, JPEG, WEBP' })}
                          </Typography.Text>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: '12px', display: 'block' }}
                          >
                             {t('autoScaledInfoText', { defaultValue: 'Logo is automatically scaled for display.' })}
                          </Typography.Text>
                        </div>
                      </details>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        style={{ display: 'none' }}
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            handleLogoSelect(e.target.files[0]);
                          }
                        }}
                      />
                    </Flex>
                  </Card>
                </Col>

                <Col xs={24} lg={10}>
                  <LogoPreview />

                  <Card
                    title={
                      <Flex align="center" gap={8}>
                        <CheckCircleOutlined style={{ color: colors.limeGreen }} />
                        <span>{t('benefitsTitle', { defaultValue: 'Benefits' })}</span>
                      </Flex>
                    }
                    size="small"
                    style={{
                      marginTop: 16,
                      border: `1px solid ${colors.lightGreen}`,
                      backgroundColor: 'var(--ant-color-bg-container)',
                    }}
                  >
                    <Flex vertical gap={12}>
                      <Flex align="center" gap={8}>
                        <CheckCircleOutlined
                          style={{ color: colors.limeGreen, fontSize: '12px' }}
                        />
                        <Typography.Text style={{ fontSize: '13px' }}>
                          {t('professionalBrandingText', { defaultValue: 'Professional branding' })}
                        </Typography.Text>
                      </Flex>
                      <Flex align="center" gap={8}>
                        <CheckCircleOutlined
                          style={{ color: colors.limeGreen, fontSize: '12px' }}
                        />
                        <Typography.Text style={{ fontSize: '13px' }}>
                          {t('consistentIdentityText', { defaultValue: 'Consistent identity' })}
                        </Typography.Text>
                      </Flex>
                      <Flex align="center" gap={8}>
                        <CheckCircleOutlined
                          style={{ color: colors.limeGreen, fontSize: '12px' }}
                        />
                        <Typography.Text style={{ fontSize: '13px' }}>
                          {t('enhancedTrustText', { defaultValue: 'Enhanced trust' })}
                        </Typography.Text>
                      </Flex>
                    </Flex>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'company-details',
            label: (
              <Flex align="center" gap={8}>
                <InfoCircleOutlined />
                <span>{t('companyDetailsTitle', { defaultValue: 'Company Details' })}</span>
              </Flex>
            ),
            children: (
              <Card
                title={
                  <Flex align="center" gap={8}>
                    <InfoCircleOutlined />
                    <span>{t('companyDetailsTitle', { defaultValue: 'Company Details' })}</span>
                  </Flex>
                }
              >
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  {t('companyDetailsDescription', { defaultValue: 'Update your company contact information displayed on invoices and the client portal.' })}
                </Typography.Text>
                <Form layout="vertical">
                  <Row gutter={16}>
                     <Col xs={24} sm={12}>
                       <Form.Item label={t('companyNameLabel', { defaultValue: 'Company Name' })}>
                         <Input
                           placeholder={t('companyNamePlaceholder', { defaultValue: 'Enter company name' })}
                          value={companyDetails.company_name}
                          onChange={e => handleCompanyDetailsChange('company_name', e.target.value)}
                        />
                      </Form.Item>
                    </Col>
                     <Col xs={24} sm={12}>
                       <Form.Item label={t('contactEmailLabel', { defaultValue: 'Contact Email' })}>
                         <Input
                           placeholder={t('contactEmailPlaceholder', { defaultValue: 'Enter contact email' })}
                           value={companyDetails.contact_email}
                          onChange={e =>
                            handleCompanyDetailsChange('contact_email', e.target.value)
                          }
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                     <Col xs={24} sm={12}>
                       <Form.Item
                         label={t('contactPhoneLabel', { defaultValue: 'Contact Phone' })}
                         name="contact_phone"
                         rules={[
                           {
                             validator: (_, value) => {
                               if (!value || value.trim() === '') return Promise.resolve();
                               if (validatePhoneNumber(value)) return Promise.resolve();
                               return Promise.reject(new Error(t('invalidPhoneNumberFormat', { defaultValue: 'Invalid phone number format' })));
                             },
                           },
                         ]}
                       >
                         <PhoneInput
                           placeholder={t('contactPhonePlaceholder', { defaultValue: 'Enter contact phone' })}
                          value={companyDetails.contact_phone}
                          onChange={value => handleCompanyDetailsChange('contact_phone', value)}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                     <Col xs={24} sm={12}>
                       <Form.Item label={t('addressLine1Label', { defaultValue: 'Address Line 1' })}>
                         <Input
                           placeholder={t('addressLine1Placeholder', { defaultValue: 'Street address' })}
                           value={companyDetails.address_line_1}
                           onChange={e =>
                             handleCompanyDetailsChange('address_line_1', e.target.value)
                           }
                         />
                       </Form.Item>
                     </Col>
                     <Col xs={24} sm={12}>
                       <Form.Item label={t('addressLine2Label', { defaultValue: 'Address Line 2' })}>
                         <Input
                           placeholder={t('addressLine2Placeholder', { defaultValue: 'Apt, suite, etc.' })}
                          value={companyDetails.address_line_2}
                          onChange={e =>
                            handleCompanyDetailsChange('address_line_2', e.target.value)
                          }
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                     <Col xs={24}>
                       <Form.Item label={t('invoiceFooterLabel', { defaultValue: 'Invoice Footer Message' })}>
                         <Input
                           placeholder={t('invoiceFooterPlaceholder', { defaultValue: 'Optional footer message for invoices' })}
                           value={companyDetails.invoice_footer_message}
                           onChange={e =>
                             handleCompanyDetailsChange('invoice_footer_message', e.target.value)
                           }
                         />
                       </Form.Item>
                     </Col>
                  </Row>
                </Form>
              </Card>
            ),
          },
        ]}
      />

      <Image
        style={{ display: 'none' }}
        src={pendingLogoUrl || customLogo || ''}
        preview={{
          visible: previewVisible,
          onVisibleChange: setPreviewVisible,
          mask: (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '16px',
              }}
            >
              {t('clickToPreviewText', { defaultValue: 'Click to preview' })}
            </div>
          ),
        }}
      />
    </Flex>
  );
};

export default ClientPortalSettings;
