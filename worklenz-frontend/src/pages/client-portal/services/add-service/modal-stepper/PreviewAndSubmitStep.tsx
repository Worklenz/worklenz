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
  const { t } = useTranslation('client-portal-services');

  const navigate = useNavigate();
  const [createService, { isLoading }] = useCreateOrganizationServiceMutation();

  const { token } = theme.useToken();

  const handleSave = async () => {
    try {
      let serviceDataToSave = { ...service.service_data };
      let imageData: string | undefined;
      let imageName: string | undefined;
      let imageType: string | undefined;

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

        if (base64Image.startsWith('data:')) {
          imageData = base64Image;
          imageName = imageFile.fileName;
          imageType = imageFile.fileType;

          console.log('Sending image data:', {
            imageName,
            imageType,
            imageDataLength: imageData.length,
          });

          serviceDataToSave = {
            ...serviceDataToSave,
            images: [],
            imageFile: undefined,
          };
        }
      } else {
        console.log('No image data found in service:', {
          hasImages: !!service.service_data?.images,
          imagesLength: service.service_data?.images?.length,
          hasImageFile: !!service.service_data?.imageFile,
        });
      }

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
        imageData,
        imageName,
        imageType,
      }).unwrap();

      message.success(t('serviceCreatedSuccessfully', { defaultValue: 'Service created successfully!' }));
      navigate(-1);
    } catch (error) {
      console.error('Failed to create service:', error);
      message.error(t('serviceCreationFailed', { defaultValue: 'Failed to create service' }));
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 24 }}>
        <Alert
          message={
            <Flex align="center" gap={8}>
              <CheckCircleOutlined style={{ color: token.colorSuccess }} />
               <Typography.Text strong>{t('serviceReadyTitle', { defaultValue: 'Your service is ready!' })}</Typography.Text>
            </Flex>
          }
          description={t('serviceReadyDescription', { defaultValue: 'Review your service details below before publishing.' })}
          type="success"
          showIcon={false}
          style={{ marginBottom: 16 }}
        />
        <Progress percent={100} strokeColor={token.colorSuccess} size="small" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <Flex vertical gap={24}>
          <Card
            title={
              <Flex align="center" gap={12}>
                <EyeOutlined style={{ color: token.colorPrimary }} />
                <Typography.Title level={4} style={{ margin: 0 }}>
                   {t('servicePreviewTitle', { defaultValue: 'Service Preview' })}
                 </Typography.Title>
                 <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                   {t('previewSubtitle', { defaultValue: 'This is how your service will appear to clients.' })}
                 </Typography.Text>
              </Flex>
            }
            style={{
              boxShadow: `0 4px 12px ${token.colorFillQuaternary}`,
              border: `2px solid ${token.colorPrimaryBg}`,
            }}
          >
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
                 {service.name || t('untitledService', { defaultValue: 'Untitled Service' })}
              </Typography.Title>
              <Tag color="green" style={{ marginBottom: 16 }}>
                 {t('availableForRequest', { defaultValue: 'Available for Request' })}
              </Tag>
            </div>

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
                         {t('priceLabel', { defaultValue: 'Price' })}
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
                         {t('categoryLabel', { defaultValue: 'Category' })}
                      </Typography.Text>
                      <Tag color="blue" style={{ fontSize: 13 }}>
                        {service.category}
                      </Tag>
                    </div>
                  )}
                </Flex>
              </div>
            )}

            <div>
              <Typography.Title
                level={5}
                style={{ marginBottom: 12, color: token.colorTextSecondary }}
              >
                 {t('serviceDescriptionTitle', { defaultValue: 'Service Description' })}
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
                     {t('noDescriptionProvided', { defaultValue: 'No description provided.' })}
                  </Typography.Text>
                </div>
              )}
            </div>
          </Card>

          {service?.service_data?.request_form && service.service_data.request_form.length > 0 ? (
            <Card
              title={
                <Flex align="center" gap={8}>
                  <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                  <Typography.Title level={4} style={{ margin: 0 }}>
                     {t('requestFormTitle', { defaultValue: 'Request Form' })}
                   </Typography.Title>
                   <Tag color="blue">
                     {service.service_data.request_form.length}{' '}
                     {t('questionsCountText', { count: service.service_data.request_form.length, defaultValue: 'question(s)' })}
                   </Tag>
                </Flex>
              }
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            >
               <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                 {t('clientsWillFillText', { defaultValue: 'Your clients will fill out this form when requesting this service.' })}
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
                          ? t('multipleChoiceLabel', { defaultValue: 'Multiple Choice' })
                          : item.type === 'attachment'
                            ? t('fileUploadLabel', { defaultValue: 'File Upload' })
                            : t('textAnswerLabel', { defaultValue: 'Text Answer' })}
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
                             {t('availableOptionsLabel', { defaultValue: 'Available Options:' })}
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
                           {t('textResponseHint', { defaultValue: 'Clients will provide a text response.' })}
                        </Typography.Text>
                      </div>
                    )}

                    {item.type === 'attachment' && (
                      <div style={{ marginLeft: 16 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                           {t('fileUploadHint', { defaultValue: 'Clients will upload files as their response.' })}
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
                 {t('noCustomFormText', { defaultValue: 'No custom form has been added yet.' })}
              </Typography.Text>
            </Card>
          )}
        </Flex>
      </div>

      <div
        style={{
          borderTop: `1px solid ${token.colorBorder}`,
          paddingTop: 16,
          flexShrink: 0,
        }}
      >
        <Flex justify="space-between" align="center">
          <Button onClick={() => setCurrent(1)} size="large">
            {t('previousButton', { defaultValue: 'Previous' })}
          </Button>

          <Flex gap={12}>
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={handleSave}
              loading={isLoading}
              size="large"
            >
              {isLoading ? t('publishingButton', { defaultValue: 'Publishing...' }) : t('publishButton', { defaultValue: 'Publish' })}
            </Button>
          </Flex>
        </Flex>
      </div>
    </div>
  );
};

export default PreviewAndSubmitStep;
