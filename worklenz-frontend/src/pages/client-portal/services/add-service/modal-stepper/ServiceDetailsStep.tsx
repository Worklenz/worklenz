import React, { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
import {
  Input,
  InputNumber,
  Select,
  Button,
  message,
  Card,
  Typography,
  Alert,
  Progress,
  Flex,
  Row,
  Col,
  theme,
  Switch,
} from '@/shared/antd-imports';
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { RcFile } from 'antd/es/upload';
import { getBase64 } from '@/utils/file-utils';
const RichTextEditor = lazy(() => import('@/components/shared/RichTextEditor'));
import { CURRENCY_OPTIONS } from '@/shared/currencies';

interface ServiceDetailsStepProps {
  setCurrent: (step: number) => void;
  service: any;
  setService: (service: any) => void;
}

const ServiceDetailsStep: React.FC<ServiceDetailsStepProps> = ({
  setCurrent,
  service,
  setService,
}) => {
  const { t, ready } = useTranslation('client-portal-services');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [placeholder, setPlaceholder] = useState('Describe your service in detail...');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get Ant Design theme tokens
  const { token } = theme.useToken();

  // Update placeholder when translation is ready
  useEffect(() => {
    if (ready) {
      setPlaceholder(t('addService.serviceDetails.descriptionPlaceholder'));
    }
  }, [ready, t]);

  // Initialize image URL from service data
  useEffect(() => {
    if (service.service_data?.images && service.service_data.images.length > 0) {
      setImageUrl(service.service_data.images[0]);
    }
  }, [service.service_data?.images]);

  // Get current theme mode
  const getThemeMode = () => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  };

  const beforeUpload = (file: RcFile) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error(
        t('addService.serviceDetails.imageUploadError') || 'Please upload an image file'
      );
      return false;
    }
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error(
        t('addService.serviceDetails.imageSizeError') || 'Image must be smaller than 5MB'
      );
      return false;
    }

    // Validate image types more specifically
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      message.error('Only JPEG, PNG, GIF, and WebP images are allowed');
      return false;
    }

    return true;
  };

  const handleImageUpload = useCallback(
    async (file: RcFile) => {
      if (!beforeUpload(file)) return false;

      setUploading(true);

      try {
        // Convert file to base64 for temporary storage
        const base64Data = (await getBase64(file)) as string;

        // Store base64 temporarily until service is created
        setImageUrl(base64Data);
        setService({
          ...service,
          service_data: {
            ...service.service_data,
            images: [base64Data], // Store base64 temporarily
            imageFile: {
              // Store file metadata for later upload
              fileName: file.name,
              fileType: file.type,
              size: file.size,
            },
          },
        });

        message.success('Image selected successfully!');
      } catch (error) {
        console.error('Error processing image:', error);
        message.error('Failed to process image. Please try again.');
      } finally {
        setUploading(false);
      }

      return false;
    },
    [service, setService]
  );

  const removeImage = () => {
    setImageUrl('');
    setService({
      ...service,
      service_data: {
        ...service.service_data,
        images: [],
        imageFile: undefined, // Clean up metadata
      },
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleNext = () => {
    const errors = [];

    if (!service.name?.trim()) {
      errors.push('Service name is required');
    }

    if (!service.service_data?.description?.trim()) {
      errors.push('Service description is required');
    }

    if (errors.length > 0) {
      message.error({
        content: (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
              Please complete the following:
            </div>
            {errors.map((error, index) => (
              <div key={index}>• {error}</div>
            ))}
          </div>
        ),
        duration: 5,
      });
      return;
    }

    setCurrent(1);
  };

  // Calculate completion for this step
  const getStepCompletion = () => {
    let completion = 0;
    if (service.name?.trim()) completion += 40;
    if (service.service_data?.description?.trim()) completion += 50;
    if (service.service_data?.images?.length > 0) completion += 10;
    return completion;
  };

  const handleDescriptionChange = (content: string) => {
    setService({
      ...service,
      service_data: {
        ...service.service_data,
        description: content,
      },
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Progress indicator for this step */}
      <div style={{ marginBottom: 24 }}>
        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <Typography.Text strong>Service Details Progress</Typography.Text>
          <Typography.Text type="secondary">{getStepCompletion()}% complete</Typography.Text>
        </Flex>
        <Progress percent={getStepCompletion()} strokeColor={token.colorSuccess} size="small" />
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <Row gutter={[24, 24]}>
          {/* Left Column - Form Inputs */}
          <Col xs={24} lg={16}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Service Name Section */}
              <Card
                title={
                  <Flex align="center" gap={8}>
                    <span>1. Service Name</span>
                    {service.name?.trim() && (
                      <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                    )}
                  </Flex>
                }
                size="small"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Choose a clear, descriptive name that clients will easily understand.
                  </Typography.Text>
                  <Row>
                    <Col xs={24} sm={16}>
                      <Input
                        placeholder="e.g., Website Design, Logo Creation, Marketing Strategy"
                        maxLength={100}
                        showCount
                        value={service.name || ''}
                        onChange={e => setService({ ...service, name: e.target.value })}
                        status={service.name?.trim() ? '' : 'warning'}
                      />
                    </Col>
                  </Row>
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12, display: 'block', marginTop: 4 }}
                  >
                    💡 Good examples: "Custom Logo Design", "SEO Audit & Strategy", "Social Media
                    Management"
                  </Typography.Text>
                </div>
              </Card>

              {/* Pricing and Category Section */}
              <Card
                title={
                  <Flex align="center" gap={8}>
                    <span>3. Pricing & Category</span>
                    <Typography.Text
                      type="secondary"
                      style={{ fontWeight: 'normal', fontSize: 12 }}
                    >
                      (Optional)
                    </Typography.Text>
                  </Flex>
                }
                size="small"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Set pricing information and categorize your service for better organization.
                  </Typography.Text>

                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        Price
                      </Typography.Text>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        precision={2}
                        placeholder="e.g., 99.99"
                        value={service.price}
                        onChange={value => setService({ ...service, price: value })}
                      />
                    </Col>
                    <Col span={12}>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        Currency
                      </Typography.Text>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="Select currency"
                        value={service.currency || 'usd'}
                        onChange={value => setService({ ...service, currency: value })}
                        options={CURRENCY_OPTIONS}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Col>
                    <Col span={12}>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        Category
                      </Typography.Text>
                      <Input
                        placeholder="e.g., Web Development, Design, Marketing"
                        maxLength={50}
                        showCount
                        value={service.category || ''}
                        onChange={e => setService({ ...service, category: e.target.value })}
                      />
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, display: 'block', marginTop: 4 }}
                      >
                        💡 Categories help organize your services for clients
                      </Typography.Text>
                    </Col>
                  </Row>
                </div>
              </Card>

              {/* Service Visibility Section */}
              <Card
                title={
                  <Flex align="center" gap={8}>
                    <span>4. {t('serviceVisibility.title')}</span>
                  </Flex>
                }
                size="small"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    {t('serviceVisibility.description')}
                  </Typography.Text>

                  <Flex align="center" gap={12}>
                    <Switch
                      checked={service.is_public ?? true}
                      onChange={checked => setService({ ...service, is_public: checked })}
                    />
                    <div>
                      <Typography.Text strong>
                        {(service.is_public ?? true)
                          ? t('serviceVisibility.showToAll')
                          : t('serviceVisibility.hiddenFromAll')}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        {(service.is_public ?? true)
                          ? t('serviceVisibility.showToAllDescription')
                          : t('serviceVisibility.hiddenFromAllDescription')}
                      </Typography.Text>
                    </div>
                  </Flex>
                </div>
              </Card>

              {/* Service Description Section */}
              <Card
                title={
                  <Flex align="center" gap={8}>
                    <span>5. Service Description</span>
                    {service.service_data?.description?.trim() && (
                      <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                    )}
                  </Flex>
                }
                size="small"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Describe your service in detail. Include what's included, your process, and what
                    clients can expect.
                  </Typography.Text>

                  <div
                    style={{
                      border: service.service_data?.description?.trim()
                        ? `1px solid ${token.colorBorder}`
                        : `1px solid ${token.colorError}`,
                      borderRadius: token.borderRadius,
                      overflow: 'hidden',
                    }}
                  >
                    <Suspense fallback={<div style={{ height: 200 }} />}>
                      <RichTextEditor
                        value={service.service_data?.description || ''}
                        onChange={handleDescriptionChange}
                        placeholder="Describe your service in detail... Include what's included, your process, timeline, and what clients can expect."
                        themeMode={getThemeMode()}
                        height={200}
                      />
                    </Suspense>
                  </div>

                  <Alert
                    message="Writing a great description"
                    description={
                      <div style={{ marginTop: 8 }}>
                        <div>• Explain what's included in your service</div>
                        <div>• Mention your typical process or approach</div>
                        <div>• Include estimated timeline or deliverables</div>
                        <div>• Highlight what makes your service unique</div>
                      </div>
                    }
                    type="info"
                    showIcon={false}
                    style={{ marginTop: 12 }}
                    banner
                  />
                </div>
              </Card>
            </div>
          </Col>

          {/* Right Column - Service Image */}
          <Col xs={24} lg={8}>
            <Card
              title={
                <Flex align="center" gap={8}>
                  <span>2. Service Image</span>
                  <Typography.Text type="secondary" style={{ fontWeight: 'normal', fontSize: 12 }}>
                    (Optional)
                  </Typography.Text>
                  {imageUrl && <CheckCircleOutlined style={{ color: token.colorSuccess }} />}
                </Flex>
              }
              size="small"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <div style={{ marginBottom: 16 }}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  Add a visual that represents your service. This helps clients understand what you
                  offer.
                </Typography.Text>

                <div
                  style={{
                    border: `2px dashed ${token.colorBorder}`,
                    borderRadius: token.borderRadius,
                    padding: 24,
                    textAlign: 'center',
                    backgroundColor: imageUrl ? 'transparent' : token.colorFillAlter,
                    transition: 'all 0.3s ease',
                  }}
                >
                  {imageUrl ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={imageUrl}
                        alt="Service preview"
                        style={{
                          maxWidth: '100%',
                          maxHeight: 300,
                          objectFit: 'cover',
                          borderRadius: 8,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}
                      />
                      <Button
                        type="primary"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={removeImage}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                        size="small"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <UploadOutlined
                        style={{ fontSize: 32, color: token.colorTextTertiary, marginBottom: 16 }}
                      />
                      <div style={{ marginBottom: 16 }}>
                        <Typography.Text style={{ display: 'block', marginBottom: 8 }}>
                          Click to upload or drag and drop
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          PNG, JPG up to 2MB • Recommended: 400x200px
                        </Typography.Text>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file as RcFile);
                        }}
                        style={{ display: 'none' }}
                      />
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => fileInputRef.current?.click()}
                        loading={uploading}
                        size="large"
                      >
                        Choose Image
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Navigation Buttons - Fixed at bottom */}
      <div
        style={{
          borderTop: `1px solid ${token.colorBorder}`,
          paddingTop: 16,
          marginTop: 16,
          flexShrink: 0,
        }}
      >
        <Flex justify="space-between" align="center">
          <Typography.Text type="secondary">
            Complete all required fields to continue
          </Typography.Text>
          <Button
            type="primary"
            onClick={handleNext}
            size="large"
            disabled={!service.name?.trim() || !service.service_data?.description?.trim()}
          >
            Continue to Request Form →
          </Button>
        </Flex>
      </div>
    </div>
  );
};

export default ServiceDetailsStep;
