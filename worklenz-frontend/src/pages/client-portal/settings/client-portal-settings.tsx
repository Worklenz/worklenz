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
  Alert
} from 'antd';
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
  SettingOutlined
} from '@ant-design/icons';
import { profileSettingsApiService } from '../../../api/settings/profile/profile-settings.api.service';
import { colors } from '../../../styles/colors';

const ClientPortalSettings = () => {
  // localization
  const { t } = useTranslation('client-portal-settings');
  
  // State for custom logo
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  
  // Load client portal settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await profileSettingsApiService.getClientPortalSettings();
      if (response.done && response.body?.logo_url) {
        setCustomLogo(response.body.logo_url);
      }
    } catch (error) {
      console.error('Failed to load client portal settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
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
    
    try {
      setUploading(true);
      
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64String = e.target?.result as string;
          
          // Upload to backend
          const response = await profileSettingsApiService.uploadClientPortalLogo(base64String);
          
          if (response.done && response.body?.logo_url) {
            setCustomLogo(response.body.logo_url);
            setLogoFile(file);
            message.success(`${file.name} uploaded successfully!`);
          } else {
            message.error('Failed to upload logo');
          }
        } catch (error) {
          console.error('Logo upload error:', error);
          message.error('Failed to upload logo');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploading(false);
      message.error('Failed to upload logo');
    }
    
    return false; // Prevent default upload
  };
  
  const handleRemoveLogo = async () => {
    try {
      setUploading(true);
      
      // Update settings with null logo_url
      const response = await profileSettingsApiService.updateClientPortalSettings({
        logo_url: null
      });
      
      if (response.done) {
        setCustomLogo(null);
        setLogoFile(null);
        message.success('Custom logo removed successfully!');
      } else {
        message.error('Failed to remove logo');
      }
    } catch (error) {
      console.error('Failed to remove logo:', error);
      message.error('Failed to remove logo');
    } finally {
      setUploading(false);
    }
  };
  
  const props: UploadProps = {
    name: 'file',
    multiple: false,
    accept: 'image/*',
    beforeUpload: handleLogoUpload,
    showUploadList: false,
    onDrop(e) {
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
        backgroundColor: 'var(--ant-color-bg-container)'
      }}
    >
      <Flex vertical gap={16} align="center">
        <div style={{ 
          padding: '24px 32px', 
          border: `1px solid ${colors.deepLightGray}`, 
          borderRadius: '8px',
          backgroundColor: 'var(--ant-color-bg-layout)',
          width: '100%',
          textAlign: 'center'
        }}>
          {customLogo ? (
            <img
              src={customLogo}
              alt="Client Portal Logo"
              style={{ 
                maxWidth: '200px', 
                maxHeight: '80px', 
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
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
          <Typography.Text type="secondary">
            {t('customizePortalText')}
          </Typography.Text>
        </Flex>
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
              {/* Current Logo Section */}
              {customLogo && (
                <>
                  <div>
                    <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
                      {t('currentLogoText')}
                    </Typography.Text>
                    <Flex align="center" gap={16} style={{ 
                      padding: '16px', 
                      border: `1px solid ${colors.deepLightGray}`, 
                      borderRadius: '8px',
                      backgroundColor: 'var(--ant-color-bg-layout)'
                    }}>
                      <img
                        src={customLogo}
                        alt="Current company logo"
                        style={{ 
                          maxWidth: 120, 
                          maxHeight: 60, 
                          objectFit: 'contain',
                          borderRadius: '4px'
                        }}
                      />
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
                            onClick={handleRemoveLogo}
                            loading={uploading}
                            size="small"
                          />
                        </Tooltip>
                      </Space>
                    </Flex>
                  </div>
                  <Divider />
                </>
              )}

              {/* Upload Section */}
              <div>
                <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
                  {t('uploadLogoText')}
                </Typography.Text>
                <Upload.Dragger {...props} style={{ 
                  maxWidth: '100%',
                  border: `2px dashed ${colors.deepLightGray}`,
                  borderRadius: '8px',
                  backgroundColor: 'var(--ant-color-bg-layout)'
                }}>
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
                  backgroundColor: 'var(--ant-color-bg-layout)'
                }}
              />
            </Flex>
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
              backgroundColor: 'var(--ant-color-bg-container)'
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
        src={customLogo || ''}
        preview={{
          visible: previewVisible,
          onVisibleChange: setPreviewVisible,
          mask: (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px'
            }}>
              Click to preview
            </div>
          ),
        }}
      />
    </Flex>
  );
};

export default ClientPortalSettings;
