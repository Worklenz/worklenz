import {
  Card,
  Flex,
  message,
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
} from '@/shared/antd-imports';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { profileSettingsApiService } from '../../../api/settings/profile/profile-settings.api.service';
import { colors } from '../../../styles/colors';
import { useMixpanelTracking } from '../../../hooks/useMixpanelTracking';
import { MixpanelEvents, ClientPortalEventProps, ClientPortalActionEventProps } from '../../../types/mixpanel-events.types';

const ClientPortalSettings = () => {
  // localization
  const { t } = useTranslation('client-portal-settings');
  const { trackMixpanelEvent } = useMixpanelTracking();

  // State for custom logo
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoUrl, setPendingLogoUrl] = useState<string | null>(null);
  const [pendingLogoRemoval, setPendingLogoRemoval] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // State for company details
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

  // Load client portal settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Track page visit
  useEffect(() => {
    const pageEventProps: ClientPortalEventProps = {
      page: 'settings',
      section: 'client_portal',
      source: 'direct_visit'
    };

    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_SETTINGS_VIEWED, pageEventProps);
  }, [trackMixpanelEvent]);

  // Cleanup object URLs on unmount
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
        }
        // Load company details
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
    // Validate file type
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('You can only upload image files!');
      return false;
    }

    // Validate file size (max 2MB)
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('Image must be smaller than 2MB!');
      return false;
    }

    // Create preview URL for the selected file
    const previewUrl = URL.createObjectURL(file);

    // Stage the file and preview
    setPendingLogoFile(file);
    setPendingLogoUrl(previewUrl);
    setPendingLogoRemoval(false);
    setHasUnsavedChanges(true);

    message.success(t('logoUploadedText'));

    return false; // Prevent default upload
  };

  const handleStageLogoRemoval = () => {
    // Track logo removal action
    const actionProps: ClientPortalActionEventProps = {
      action_type: 'delete',
      item_type: 'settings',
      page: 'settings',
      section: 'client_portal',
      source: 'remove_logo_button'
    };

    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_LOGO_REMOVED, actionProps);

    // Stage logo removal
    setPendingLogoRemoval(true);
    setPendingLogoFile(null);
    setPendingLogoUrl(null);
    setHasUnsavedChanges(true);

    message.success(t('logoRemovedText'));
  };

  // Handle company details change
  const handleCompanyDetailsChange = (field: string, value: string) => {
    setCompanyDetails(prev => ({ ...prev, [field]: value }));
    // Check if there are changes
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
        // Track logo upload action
        const actionProps: ClientPortalActionEventProps = {
          action_type: 'create',
          item_type: 'settings',
          page: 'settings',
          section: 'client_portal',
          source: 'save_changes_button'
        };

        trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_LOGO_UPLOADED, actionProps);

        // Upload new logo
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64String = e.target?.result as string;
            const response = await profileSettingsApiService.uploadClientPortalLogo(base64String);

            if (response.done && response.body?.logo_url) {
              setCustomLogo(response.body.logo_url);
            }
          } catch (error) {
            console.error('Logo upload error:', error);
            message.error('Failed to upload logo');
            return;
          } finally {
            // Reset pending states
            resetPendingChanges();
            setSaving(false);
            message.success(t('settingsSavedText'));
          }
        };
        reader.readAsDataURL(pendingLogoFile);
      } else if (pendingLogoRemoval) {
        // Remove logo
        const response = await profileSettingsApiService.updateClientPortalSettings({
          logo_url: null,
        });

        if (response.done) {
          // Track successful settings save
          const saveProps: ClientPortalActionEventProps = {
            action_type: 'edit',
            item_type: 'settings',
            page: 'settings',
            section: 'client_portal',
            source: 'save_changes_button',
            success: true
          };

          trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_SETTINGS_SAVED, saveProps);

          setCustomLogo(null);
          resetPendingChanges();
          message.success(t('settingsSavedText'));
        } else {
          message.error('Failed to remove logo');
        }
        setSaving(false);
      }

      // Save company details if changed
      const companyDetailsChanged = JSON.stringify(companyDetails) !== JSON.stringify(originalCompanyDetails);
      if (companyDetailsChanged) {
        const response = await profileSettingsApiService.updateClientPortalSettings({
          ...companyDetails,
        });

        if (response.done) {
          setOriginalCompanyDetails(companyDetails);
          if (!pendingLogoFile && !pendingLogoRemoval) {
            message.success(t('settingsSavedText'));
          }
        } else {
          message.error('Failed to save company details');
        }
      }

      // If no logo changes and no company details changes
      if (!pendingLogoFile && !pendingLogoRemoval && !companyDetailsChanged) {
        resetPendingChanges();
      }
      
      setSaving(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      message.error('Failed to save settings');
      setSaving(false);
    }
  };

  const handleCancelChanges = () => {
    resetPendingChanges();
    setCompanyDetails(originalCompanyDetails);
    message.info(t('discardButton'));
  };

  const resetPendingChanges = () => {
    setPendingLogoFile(null);
    setPendingLogoUrl(null);
    setPendingLogoRemoval(false);
    setHasUnsavedChanges(false);

    // Clean up object URLs to prevent memory leaks
    if (pendingLogoUrl) {
      URL.revokeObjectURL(pendingLogoUrl);
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

  // Preview component
  const LogoPreview = () => (
    <Card
      title={
        <Flex align="center" gap={8}>
          <EyeOutlined />
          <span>{t('logoPreviewTitle')}</span>
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
          {(pendingLogoUrl && !pendingLogoRemoval) ? (
            <img
              src={pendingLogoUrl}
              alt="New Client Portal Logo"
              style={{
                maxWidth: '200px',
                maxHeight: '80px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                border: '2px dashed #1890ff',
                borderRadius: '4px'
              }}
            />
          ) : pendingLogoRemoval ? (
            <Flex vertical gap={8} align="center">
              <PictureOutlined style={{ fontSize: '32px', color: colors.lightGray }} />
              <Typography.Text type="secondary">{t('noLogoUploadedText')}</Typography.Text>
              <Tag color="orange">Pending Removal</Tag>
            </Flex>
          ) : customLogo ? (
            <img
              src={customLogo}
              alt="Client Portal Logo"
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
              <Typography.Text type="secondary">{t('noLogoUploadedText')}</Typography.Text>
            </Flex>
          )}
        </div>

        <Flex gap={8} wrap="wrap" justify="center">
          <Tag color="blue">{t('headerDisplayTag')}</Tag>
          <Tag color="green">{t('responsiveTag')}</Tag>
          <Tag color="orange">{t('autoScaledTag')}</Tag>
          {pendingLogoUrl && !pendingLogoRemoval && (
            <Tag color="cyan">Pending Upload</Tag>
          )}
          {pendingLogoRemoval && (
            <Tag color="orange">Pending Removal</Tag>
          )}
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
      {/* Header */}
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Flex vertical gap={4}>
          <Flex align="center" gap={12}>
            <SettingOutlined style={{ fontSize: 20 }} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('title')}
            </Typography.Title>
          </Flex>
          <Typography.Text type="secondary">{t('customizePortalText')}</Typography.Text>
        </Flex>

        {/* Save/Cancel Buttons in Header */}
        {hasUnsavedChanges && (
          <Space size="middle">
            <Space>
              <ExclamationCircleOutlined style={{ color: '#faad14' }} />
              <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                {t('pendingChangesText')}
              </Typography.Text>
            </Space>
            <Space>
              <Button
                onClick={handleCancelChanges}
                icon={<CloseOutlined />}
              >
                {t('cancelButton')}
              </Button>
              <Button
                type="primary"
                onClick={handleSaveChanges}
                loading={saving}
                icon={<SaveOutlined />}
              >
                {saving ? t('savingText') : t('saveButton')}
              </Button>
            </Space>
          </Space>
        )}
      </Flex>

      {/* Main Content */}
      <Row gutter={[24, 24]}>
        {/* Left Column - Upload Section */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Flex align="center" gap={8}>
                <UploadOutlined />
                <span>{t('logoManagementTitle')}</span>
              </Flex>
            }
            style={{ height: 'fit-content' }}
          >
            <Flex vertical gap={24}>
              {/* Current/Pending Logo Section */}
              {(customLogo || pendingLogoUrl || pendingLogoRemoval) && (
                <>
                  <div>
                    <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
                      {pendingLogoUrl ? t('newLogoText') : t('currentLogoText')}
                    </Typography.Text>

                    {!pendingLogoRemoval && (
                      <Flex
                        align="center"
                        gap={16}
                        style={{
                          padding: '16px',
                          border: pendingLogoUrl
                            ? `2px dashed #1890ff`
                            : `1px solid ${colors.deepLightGray}`,
                          borderRadius: '8px',
                          backgroundColor: 'var(--ant-color-bg-layout)',
                        }}
                      >
                        <img
                          src={pendingLogoUrl || customLogo || ''}
                          alt={pendingLogoUrl ? "New company logo" : "Current company logo"}
                          style={{
                            maxWidth: 120,
                            maxHeight: 60,
                            objectFit: 'contain',
                            borderRadius: '4px',
                          }}
                        />
                        <Space direction="vertical" size="small">
                          <Space>
                            <Tooltip title={t('previewLogoTooltip')}>
                              <Button
                                type="text"
                                icon={<EyeOutlined />}
                                onClick={() => setPreviewVisible(true)}
                                size="small"
                              />
                            </Tooltip>
                            <Tooltip title={t('removeLogoTooltip')}>
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={handleStageLogoRemoval}
                                size="small"
                              />
                            </Tooltip>
                          </Space>
                          {pendingLogoUrl && (
                            <Tag color="blue" size="small">Pending Upload</Tag>
                          )}
                        </Space>
                      </Flex>
                    )}

                    {pendingLogoRemoval && (
                      <Alert
                        message="Logo will be removed"
                        type="warning"
                        showIcon
                        icon={<ExclamationCircleOutlined />}
                        style={{ marginBottom: 8 }}
                      />
                    )}
                  </div>
                  <Divider />
                </>
              )}

              {/* Upload Section */}
              <div>
                <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
                  {t('uploadLogoText')}
                </Typography.Text>
                <Upload.Dragger
                  {...props}
                  style={{
                    maxWidth: '100%',
                    border: `2px dashed ${colors.deepLightGray}`,
                    borderRadius: '8px',
                    backgroundColor: 'var(--ant-color-bg-layout)',
                  }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ fontSize: '32px', color: colors.skyBlue }} />
                  </p>
                  <p className="ant-upload-text" style={{ fontSize: '16px', marginBottom: '8px' }}>
                    {t('uploadLogoText')}
                  </p>
                  <p className="ant-upload-hint" style={{ color: colors.lightGray }}>
                    {t('uploadLogoAltText')}
                  </p>
                </Upload.Dragger>
              </div>

              {/* Guidelines */}
              <Alert
                message={t('logoGuidelinesTitle')}
                description={
                  <Flex vertical gap={8}>
                    <Typography.Text>{t('recommendedSizeText')}</Typography.Text>
                    <Typography.Text>{t('maxFileSizeText')}</Typography.Text>
                    <Typography.Text>{t('supportedFormatsText')}</Typography.Text>
                    <Typography.Text>{t('autoScaledInfoText')}</Typography.Text>
                  </Flex>
                }
                type="info"
                icon={<InfoCircleOutlined />}
                showIcon
                style={{
                  border: `1px solid ${colors.midBlue}`,
                  backgroundColor: 'var(--ant-color-bg-layout)',
                }}
              />
            </Flex>
          </Card>

          {/* Company Details Card */}
          <Card
            title={
              <Flex align="center" gap={8}>
                <InfoCircleOutlined />
                <span>{t('companyDetailsTitle')}</span>
              </Flex>
            }
            style={{ marginTop: 24 }}
          >
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {t('companyDetailsDescription')}
            </Typography.Text>
            <Form layout="vertical">
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label={t('companyNameLabel')}>
                    <Input
                      placeholder={t('companyNamePlaceholder')}
                      value={companyDetails.company_name}
                      onChange={(e) => handleCompanyDetailsChange('company_name', e.target.value)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label={t('contactEmailLabel')}>
                    <Input
                      placeholder={t('contactEmailPlaceholder')}
                      value={companyDetails.contact_email}
                      onChange={(e) => handleCompanyDetailsChange('contact_email', e.target.value)}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label={t('contactPhoneLabel')}>
                    <Input
                      placeholder={t('contactPhonePlaceholder')}
                      value={companyDetails.contact_phone}
                      onChange={(e) => handleCompanyDetailsChange('contact_phone', e.target.value)}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label={t('addressLine1Label')}>
                    <Input
                      placeholder={t('addressLine1Placeholder')}
                      value={companyDetails.address_line_1}
                      onChange={(e) => handleCompanyDetailsChange('address_line_1', e.target.value)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label={t('addressLine2Label')}>
                    <Input
                      placeholder={t('addressLine2Placeholder')}
                      value={companyDetails.address_line_2}
                      onChange={(e) => handleCompanyDetailsChange('address_line_2', e.target.value)}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item label={t('invoiceFooterLabel')}>
                    <Input
                      placeholder={t('invoiceFooterPlaceholder')}
                      value={companyDetails.invoice_footer_message}
                      onChange={(e) => handleCompanyDetailsChange('invoice_footer_message', e.target.value)}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        {/* Right Column - Preview */}
        <Col xs={24} lg={10}>
          <LogoPreview />

          {/* Additional Info Card */}
          <Card
            title={
              <Flex align="center" gap={8}>
                <CheckCircleOutlined style={{ color: colors.limeGreen }} />
                <span>{t('benefitsTitle')}</span>
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
                <CheckCircleOutlined style={{ color: colors.limeGreen, fontSize: '12px' }} />
                <Typography.Text style={{ fontSize: '13px' }}>
                  {t('professionalBrandingText')}
                </Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <CheckCircleOutlined style={{ color: colors.limeGreen, fontSize: '12px' }} />
                <Typography.Text style={{ fontSize: '13px' }}>
                  {t('consistentIdentityText')}
                </Typography.Text>
              </Flex>
              <Flex align="center" gap={8}>
                <CheckCircleOutlined style={{ color: colors.limeGreen, fontSize: '12px' }} />
                <Typography.Text style={{ fontSize: '13px' }}>
                  {t('enhancedTrustText')}
                </Typography.Text>
              </Flex>
            </Flex>
          </Card>
        </Col>
      </Row>


      {/* Image Preview Modal */}
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
              Click to preview
            </div>
          ),
        }}
      />
    </Flex>
  );
};

export default ClientPortalSettings;
