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
  const [placeholder, setPlaceholder] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { token } = theme.useToken();

  useEffect(() => {
    if (ready) {
      setPlaceholder(t('addService.serviceDetails.descriptionPlaceholder', { defaultValue: 'Describe your service...' }));
    }
  }, [ready, t]);

  useEffect(() => {
    if (service.service_data?.images && service.service_data.images.length > 0) {
      setImageUrl(service.service_data.images[0]);
    }
  }, [service.service_data?.images]);

  const getThemeMode = () => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  };

  const beforeUpload = (file: RcFile) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error(t('addService.serviceDetails.imageUploadError', { defaultValue: 'Only image files are allowed.' }));
      return false;
    }
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error(t('addService.serviceDetails.imageSizeError', { defaultValue: 'Image must be less than 5MB.' }));
      return false;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      message.error(t('imageFileTypeError', { defaultValue: 'Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.' }));
      return false;
    }

    return true;
  };

  const handleImageUpload = useCallback(
    async (file: RcFile) => {
      if (!beforeUpload(file)) return false;

      setUploading(true);

      try {
        const base64Data = (await getBase64(file)) as string;

        setImageUrl(base64Data);
        setService({
          ...service,
          service_data: {
            ...service.service_data,
            images: [base64Data],
            imageFile: {
              fileName: file.name,
              fileType: file.type,
              size: file.size,
            },
          },
        });

        message.success(t('imageSelectedSuccess', { defaultValue: 'Image selected successfully' }));
      } catch (error) {
        console.error('Error processing image:', error);
        message.error(t('imageProcessError', { defaultValue: 'Error processing image' }));
      } finally {
        setUploading(false);
      }

      return false;
    },
    [service, setService, t]
  );

  const removeImage = () => {
    setImageUrl('');
    setService({
      ...service,
      service_data: {
        ...service.service_data,
        images: [],
        imageFile: undefined,
      },
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleNext = () => {
    const errors = [];

    if (!service.name?.trim()) {
      errors.push(t('serviceNameRequiredError', { defaultValue: 'Service name is required' }));
    }

    if (!service.service_data?.description?.trim()) {
      errors.push(t('serviceDescriptionRequiredError', { defaultValue: 'Service description is required' }));
    }

    if (errors.length > 0) {
      message.error({
        content: (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
              {t('pleaseCompleteFollowing', { defaultValue: 'Please complete the following:' })}
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
      <div style={{ marginBottom: 24 }}>
        <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <Typography.Text strong>{t('serviceDetailsProgressTitle', { defaultValue: 'Service Details' })}</Typography.Text>
          <Typography.Text type="secondary">{getStepCompletion()}% complete</Typography.Text>
        </Flex>
        <Progress percent={getStepCompletion()} strokeColor={token.colorSuccess} size="small" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Card
                  title={
                    <Flex align="center" gap={8}>
                      <span>{t('step1CardTitle', { defaultValue: 'Service Information' })}</span>
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
                    {t('serviceNameHint', { defaultValue: 'Give your service a clear, descriptive name.' })}
                  </Typography.Text>
                  <Row>
                    <Col xs={24} sm={16}>
                      <Input
                        placeholder={t('serviceNamePlaceholderExample', { defaultValue: 'e.g. Website Redesign' })}
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
                     💡 {t('goodExamplesTitle', { defaultValue: 'Examples:' })} {t('goodExamples', { defaultValue: 'Logo Design, SEO Audit, Social Media Management' })}
                  </Typography.Text>
                </div>
              </Card>

                <Card
                  title={
                    <Flex align="center" gap={8}>
                      <span>{t('step3CardTitle', { defaultValue: 'Pricing & Category' })}</span>
                      <Typography.Text
                        type="secondary"
                        style={{ fontWeight: 'normal', fontSize: 12 }}
                      >
                        {t('optionalLabel', { defaultValue: '(Optional)' })}
                      </Typography.Text>
                  </Flex>
                }
                size="small"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    {t('pricingCategoryHint', { defaultValue: 'Optionally set a price and category for this service.' })}
                  </Typography.Text>

                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        {t('priceLabel', { defaultValue: 'Price' })}
                      </Typography.Text>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        precision={2}
                        placeholder={t('pricePlaceholder', { defaultValue: '0.00' })}
                        value={service.price}
                        onChange={value => setService({ ...service, price: value })}
                      />
                    </Col>
                    <Col span={12}>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        {t('currencyLabel', { defaultValue: 'Currency' })}
                      </Typography.Text>
                      <Select
                        style={{ width: '100%' }}
                        placeholder={t('currencyPlaceholder', { defaultValue: 'Select currency' })}
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
                        {t('categoryLabel', { defaultValue: 'Category' })}
                      </Typography.Text>
                      <Input
                        placeholder={t('categoryPlaceholder', { defaultValue: 'e.g. Design' })}
                        maxLength={50}
                        showCount
                        value={service.category || ''}
                        onChange={e => setService({ ...service, category: e.target.value })}
                      />
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, display: 'block', marginTop: 4 }}
                      >
                         💡 {t('categoryHint', { defaultValue: 'Categorize your service to help clients find it.' })}
                      </Typography.Text>
                    </Col>
                  </Row>
                </div>
              </Card>

                <Card
                  title={
                    <Flex align="center" gap={8}>
                      <span>{t('step4CardTitle', { defaultValue: 'Service Visibility', title: t('serviceVisibility.title', { defaultValue: 'Visibility' }) })}</span>
                  </Flex>
                }
                size="small"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    {t('serviceVisibility.description', { defaultValue: 'Choose who can see and request this service.' })}
                  </Typography.Text>

                  <Flex align="center" gap={12}>
                    <Switch
                      checked={service.is_public ?? true}
                      onChange={checked => setService({ ...service, is_public: checked })}
                    />
                    <div>
                      <Typography.Text strong>
                        {(service.is_public ?? true)
                          ? t('serviceVisibility.showToAll', { defaultValue: 'Visible to all clients' })
                          : t('serviceVisibility.hiddenFromAll', { defaultValue: 'Hidden from all clients' })}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        {(service.is_public ?? true)
                          ? t('serviceVisibility.showToAllDescription', { defaultValue: 'Anyone can view and request this service.' })
                          : t('serviceVisibility.hiddenFromAllDescription', { defaultValue: 'Only you can see this service.' })}
                      </Typography.Text>
                    </div>
                  </Flex>
                </div>
              </Card>

              <Card
                title={
                  <Flex align="center" gap={8}>
                    <span>{t('step5CardTitle', { defaultValue: 'Description' })}</span>
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
                    {t('serviceDescriptionHint', { defaultValue: 'Describe what this service includes and what clients can expect.' })}
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
                        placeholder={placeholder || t('addService.serviceDetails.descriptionPlaceholder', { defaultValue: 'Describe your service...' })}
                        themeMode={getThemeMode()}
                        height={200}
                      />
                    </Suspense>
                  </div>

                   <Alert
                     message={t('writingGreatDescription', { defaultValue: 'Tips for a great description:' })}
                     description={
                       <div style={{ marginTop: 8 }}>
                         <div>{t('descriptionBullet1', { defaultValue: 'Be specific about what is included.' })}</div>
                         <div>{t('descriptionBullet2', { defaultValue: 'Mention delivery time or process.' })}</div>
                         <div>{t('descriptionBullet3', { defaultValue: 'Highlight any prerequisites.' })}</div>
                         <div>{t('descriptionBullet4', { defaultValue: 'Set clear expectations for clients.' })}</div>
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

          <Col xs={24} lg={8}>
            <Card
              title={
                <Flex align="center" gap={8}>
                  <span>{t('step2CardTitle', { defaultValue: 'Service Image' })}</span>
                  <Typography.Text type="secondary" style={{ fontWeight: 'normal', fontSize: 12 }}>
                    {t('optionalLabel', { defaultValue: '(Optional)' })}
                  </Typography.Text>
                  {imageUrl && <CheckCircleOutlined style={{ color: token.colorSuccess }} />}
                </Flex>
              }
              size="small"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <div style={{ marginBottom: 16 }}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  {t('serviceImageHint', { defaultValue: 'Add an image to make your service stand out.' })}
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
                         {t('removeButton', { defaultValue: 'Remove' })}
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <UploadOutlined
                        style={{ fontSize: 32, color: token.colorTextTertiary, marginBottom: 16 }}
                      />
                      <div style={{ marginBottom: 16 }}>
                         <Typography.Text style={{ display: 'block', marginBottom: 8 }}>
                           {t('clickToUploadOrDrag', { defaultValue: 'Click to upload or drag and drop' })}
                         </Typography.Text>
                         <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                           {t('imageRequirements', { defaultValue: 'SVG, PNG, JPG or GIF (max. 5MB)' })}
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
                         {t('chooseImageButton', { defaultValue: 'Choose Image' })}
                       </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

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
            {t('completeRequiredFields', { defaultValue: 'Complete all required fields to continue.' })}
          </Typography.Text>
          <Button
            type="primary"
            onClick={handleNext}
            size="large"
            disabled={!service.name?.trim() || !service.service_data?.description?.trim()}
          >
            {t('continueToRequestForm', { defaultValue: 'Continue to Request Form' })}
          </Button>
        </Flex>
      </div>
    </div>
  );
};

export default ServiceDetailsStep;
