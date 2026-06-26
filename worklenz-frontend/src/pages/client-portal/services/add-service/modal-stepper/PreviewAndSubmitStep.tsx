import {
  Button,
  Flex,
  Space,
  Typography,
  message,
  Card,
  Tag,
  Divider,
  Alert,
  Progress,
  Spin,
  theme,
} from '@/shared/antd-imports';
import { CheckCircleOutlined, EyeOutlined, RocketOutlined } from '@ant-design/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TempServicesType } from '../../../../../types/client-portal/temp-client-portal.types';
import { useCreateOrganizationServiceMutation } from '../../../../../api/client-portal/client-portal-api';
import { useNavigate } from 'react-router-dom';
import { getCurrencyLabel } from '@/shared/currencies';

type PreviewAndSubmitStepProps = {
  setCurrent: (index: number) => void;
  service: TempServicesType;
};

const PreviewAndSubmitStep = ({ setCurrent, service }: PreviewAndSubmitStepProps) => {
  // localization
  const { t } = useTranslation('client-portal-services');

  const navigate = useNavigate();
  const [createService, { isLoading }] = useCreateOrganizationServiceMutation();

  // Get Ant Design theme tokens
  const { token } = theme.useToken();

  // function to handle save
  const handleSave = async () => {
    try {
      // Prepare service data without image
      let serviceDataToSave = { ...service.service_data };
      let imageData: string | undefined;
      let imageName: string | undefined;
      let imageType: string | undefined;

      // Extract image data if present
      console.log('Service data before processing:', service.service_data);
      if (
        service.service_data?.images &&
        service.service_data.images.length > 0 &&
        service.service_data.imageFile
      ) {
        const base64Image = service.service_data.images[0];
        const imageFile = service.service_data.imageFile;

        console.log('Found image data:', {
          hasImage: !!base64Image,
          imageLength: base64Image?.length,
          imageFile,
          startsWithData: base64Image?.startsWith('data:'),
        });

        // Only process if it's base64 data (starts with 'data:')
        if (base64Image.startsWith('data:')) {
          imageData = base64Image;
          imageName = imageFile.fileName;
          imageType = imageFile.fileType;

          console.log('Sending image data:', {
            imageName,
            imageType,
            imageDataLength: imageData.length,
          });

          // Remove image data from service_data since it will be handled separately
          serviceDataToSave = {
            ...serviceDataToSave,
            images: [], // Will be populated by backend after S3 upload
            imageFile: undefined, // Remove temporary metadata
          };
        }
      } else {
        console.log('No image data found in service:', {
          hasImages: !!service.service_data?.images,
          imagesLength: service.service_data?.images?.length,
          hasImageFile: !!service.service_data?.imageFile,
        });
      }

      // Create service with image in single request
      await createService({
        name: service.name,
        description:
          typeof service.service_data?.description === 'string'
            ? service.service_data.description
            : service.service_data?.description?.toString() || '',
        service_data: serviceDataToSave,
        is_public: service.is_public ?? true,
        price: service.price,
        currency: service.currency,
        category: service.category,
        // Include image data for single request upload
        imageData,
        imageName,
        imageType,
      }).unwrap();

      message.success(t('serviceCreatedSuccessfully') || 'Service created successfully!');
      navigate(-1); // Go back to services list
    } catch (error) {
      console.error('Failed to create service:', error);
      message.error(t('serviceCreationFailed') || 'Failed to create service. Please try again.');
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with completion status */}
      <div style={{ marginBottom: 24 }}>
        <Alert
          message={
            <Flex align="center" gap={8}>
              <CheckCircleOutlined style={{ color: token.colorSuccess }} />
              <Typography.Text strong>Service Ready to Publish!</Typography.Text>
            </Flex>
          }
          description="Review your service details below and publish when ready. You can edit these details anytime after publishing."
          type="success"
          showIcon={false}
          style={{ marginBottom: 16 }}
        />
        <Progress percent={100} strokeColor={token.colorSuccess} size="small" />
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <Flex vertical gap={24}>
          {/* Service Preview Card */}
          <Card
            title={
              <Flex align="center" gap={12}>
                <EyeOutlined style={{ color: token.colorPrimary }} />
                <Typography.Title level={4} style={{ margin: 0 }}>
                  Service Preview
                </Typography.Title>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  This is how clients will see your service
                </Typography.Text>
              </Flex>
            }
            style={{
              boxShadow: `0 4px 12px ${token.colorFillQuaternary}`,
              border: `2px solid ${token.colorPrimaryBg}`,
            }}
          >
            {/* Service Header */}
            <div style={{ marginBottom: 20 }}>
              <Typography.Title
                level={2}
                style={{
                  margin: 0,
                  marginBottom: 8,
                  color: token.colorPrimary,
                  fontSize: 24,
                }}
              >
                {service.name || 'Untitled Service'}
              </Typography.Title>
              <Tag color="green" style={{ marginBottom: 16 }}>
                Available for Request
              </Tag>
            </div>

            {/* Service Image */}
            {service?.service_data?.images?.[0] && (
              <div style={{ marginBottom: 20, textAlign: 'center' }}>
                <img
                  src={service.service_data.images[0]}
                  alt={service?.name ?? ''}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 300,
                    objectFit: 'cover',
                    borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                />
              </div>
            )}

            {/* Pricing and Category */}
            {(service.price || service.category) && (
              <div style={{ marginBottom: 20 }}>
                <Divider style={{ margin: '16px 0' }} />
                <Flex gap={16} wrap>
                  {service.price !== null && service.price !== undefined && (
                    <div>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                      >
                        Price
                      </Typography.Text>
                      <Typography.Text strong style={{ fontSize: 18, color: token.colorSuccess }}>
                        {getCurrencyLabel(service.currency || 'usd').split(' - ')[0]}{' '}
                        {service.price.toFixed(2)}
                      </Typography.Text>
                    </div>
                  )}
                  {service.category && (
                    <div>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                      >
                        Category
                      </Typography.Text>
                      <Tag color="blue" style={{ fontSize: 13 }}>
                        {service.category}
                      </Tag>
                    </div>
                  )}
                </Flex>
              </div>
            )}

            {/* Service Description */}
            <div>
              <Typography.Title
                level={5}
                style={{ marginBottom: 12, color: token.colorTextSecondary }}
              >
                Service Description
              </Typography.Title>
              {service?.service_data?.description ? (
                <div
                  style={{
                    padding: 20,
                    backgroundColor: token.colorFillAlter,
                    borderRadius: token.borderRadius,
                    border: `1px solid ${token.colorBorder}`,
                    lineHeight: 1.6,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: service.service_data.description,
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: 20,
                    backgroundColor: token.colorFillTertiary,
                    borderRadius: token.borderRadius,
                    border: `1px solid ${token.colorBorder}`,
                    textAlign: 'center',
                  }}
                >
                  <Typography.Text type="secondary" style={{ fontStyle: 'italic' }}>
                    No description provided
                  </Typography.Text>
                </div>
              )}
            </div>
          </Card>

          {/* Request Form Preview */}
          {service?.service_data?.request_form && service.service_data.request_form.length > 0 ? (
            <Card
              title={
                <Flex align="center" gap={8}>
                  <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    Request Form
                  </Typography.Title>
                  <Tag color="blue">
                    {service.service_data.request_form.length} question
                    {service.service_data.request_form.length !== 1 ? 's' : ''}
                  </Tag>
                </Flex>
              }
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            >
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Clients will fill out this form when requesting your service:
              </Typography.Text>

              <Flex vertical gap={16}>
                {service.service_data.request_form.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      padding: 16,
                      backgroundColor: token.colorPrimaryBg,
                      border: `1px solid ${token.colorPrimaryBorder}`,
                      borderRadius: token.borderRadius,
                    }}
                  >
                    <Flex justify="space-between" align="flex-start" style={{ marginBottom: 8 }}>
                      <Typography.Text strong style={{ fontSize: 14 }}>
                        {index + 1}. {item.question}
                      </Typography.Text>
                      <Tag
                        color={
                          item.type === 'text'
                            ? 'green'
                            : item.type === 'multipleChoice'
                              ? 'blue'
                              : 'orange'
                        }
                        style={{ fontSize: 10 }}
                      >
                        {item.type === 'multipleChoice'
                          ? 'Multiple Choice'
                          : item.type === 'attachment'
                            ? 'File Upload'
                            : 'Text Answer'}
                      </Tag>
                    </Flex>

                    {item.type === 'multipleChoice' &&
                      item.answer &&
                      Array.isArray(item.answer) && (
                        <div style={{ marginLeft: 16 }}>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 12, display: 'block', marginBottom: 8 }}
                          >
                            Available options:
                          </Typography.Text>
                          <Flex wrap gap={6}>
                            {item.answer.map((option, optionIndex) => (
                              <span
                                key={optionIndex}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: token.colorPrimaryBg,
                                  border: `1px solid ${token.colorPrimaryBorder}`,
                                  borderRadius: 16,
                                  fontSize: 11,
                                  color: token.colorPrimary,
                                }}
                              >
                                {option}
                              </span>
                            ))}
                          </Flex>
                        </div>
                      )}

                    {item.type === 'text' && (
                      <div style={{ marginLeft: 16 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Clients can provide a detailed text response
                        </Typography.Text>
                      </div>
                    )}

                    {item.type === 'attachment' && (
                      <div style={{ marginLeft: 16 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Clients can upload files (documents, images, etc.)
                        </Typography.Text>
                      </div>
                    )}
                  </div>
                ))}
              </Flex>
            </Card>
          ) : (
            <Card
              style={{ textAlign: 'center', padding: 24, backgroundColor: token.colorFillAlter }}
            >
              <Typography.Text type="secondary">
                No custom request form - clients can request this service directly
              </Typography.Text>
            </Card>
          )}
        </Flex>
      </div>

      {/* Fixed Action Buttons */}
      <div
        style={{
          borderTop: `1px solid ${token.colorBorder}`,
          paddingTop: 16,
          flexShrink: 0,
        }}
      >
        <Flex justify="space-between" align="center">
          <Button onClick={() => setCurrent(1)} size="large">
            ← Previous
          </Button>

          <Flex gap={12}>
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={handleSave}
              loading={isLoading}
              size="large"
            >
              {isLoading ? 'Publishing...' : 'Publish Service'}
            </Button>
          </Flex>
        </Flex>
      </div>
    </div>
  );
};

export default PreviewAndSubmitStep;
