import {
  Button,
  Flex,
  Space,
  Typography,
  message,
  Card,
  Tag,
  Divider,
} from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  TempServicesType,
  TempRequestFromItemType,
} from '../../../../types/client-portal/temp-client-portal.types';
import { useUpdateOrganizationServiceMutation } from '../../../../api/client-portal/client-portal-api';

type EditPreviewAndSubmitStepProps = {
  setCurrent: (index: number) => void;
  service: TempServicesType;
  isEdit?: boolean;
};

const EditPreviewAndSubmitStep = ({
  setCurrent,
  service,
  isEdit = false,
}: EditPreviewAndSubmitStepProps) => {
  // localization
  const { t } = useTranslation('client-portal-services');
  const { id } = useParams<{ id: string }>();

  const navigate = useNavigate();
  const [updateService, { isLoading }] = useUpdateOrganizationServiceMutation();

  // function to handle save/update
  const handleSave = async () => {
    if (!id) {
      message.error('Service ID is missing');
      return;
    }

    try {
      await updateService({
        id,
        data: {
          name: service.name,
          description: service.service_data?.description,
          service_data: service.service_data,
          is_public: false,
        },
      }).unwrap();
      message.success(t('serviceUpdatedSuccessfully') || 'Service updated successfully!');
      navigate(-1); // Go back to services list
    } catch (error) {
      console.error('Failed to update service:', error);
      message.error(t('serviceUpdateFailed') || 'Failed to update service. Please try again.');
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <Flex vertical gap={24}>
          {/* Service Overview Card */}
          <Card
            title={
              <Typography.Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                {service.name}
              </Typography.Title>
            }
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          >
            <Flex vertical gap={16}>
              {service?.service_data?.images?.[0] && (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={service.service_data.images[0]}
                    alt={service?.name ?? ''}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 250,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid #f0f0f0',
                    }}
                  />
                </div>
              )}

              <div>
                <Typography.Text
                  strong
                  style={{ display: 'block', marginBottom: 8, color: '#666' }}
                >
                  {t('addService.serviceDetails.serviceDescription') || 'Description'}:
                </Typography.Text>
                {service?.service_data?.description ? (
                  <div
                    style={{
                      padding: 16,
                      backgroundColor: '#fafafa',
                      borderRadius: 6,
                      border: '1px solid #f0f0f0',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: service.service_data.description,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      padding: 16,
                      backgroundColor: '#f5f5f5',
                      borderRadius: 6,
                      border: '1px solid #d9d9d9',
                      textAlign: 'center',
                    }}
                  >
                    <Typography.Text type="secondary" style={{ fontStyle: 'italic' }}>
                      {t('noDescriptionProvided')}
                    </Typography.Text>
                  </div>
                )}
              </div>
            </Flex>
          </Card>

          {/* Request Form Preview Card */}
          {service?.service_data?.request_form && service.service_data.request_form.length > 0 && (
            <Card
              title={
                <Flex align="center" gap={8}>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {t('requestFormPreview')}
                  </Typography.Title>
                  <Tag color="blue">
                    {service.service_data.request_form.length} {t('questionsCount')}
                  </Tag>
                </Flex>
              }
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            >
              <Flex vertical gap={12}>
                {service.service_data.request_form.map(
                  (item: TempRequestFromItemType, index: number) => (
                    <Card
                      key={index}
                      size="small"
                      style={{
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #e9ecef',
                      }}
                    >
                      <Flex vertical gap={8}>
                        <Flex justify="space-between" align="start">
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
                          >
                            {t(`${item.type}Option`)}
                          </Tag>
                        </Flex>

                        {item.type === 'multipleChoice' &&
                          item.answer &&
                          Array.isArray(item.answer) && (
                            <div>
                              <Typography.Text
                                type="secondary"
                                style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                              >
                                {t('optionsLabel')}:
                              </Typography.Text>
                              <Flex wrap gap={4}>
                                {item.answer.map((option: string, optionIndex: number) => (
                                  <Tag key={optionIndex} style={{ margin: 0 }}>
                                    {option}
                                  </Tag>
                                ))}
                              </Flex>
                            </div>
                          )}
                      </Flex>
                    </Card>
                  )
                )}
              </Flex>
            </Card>
          )}
        </Flex>
      </div>

      {/* Fixed Action Buttons */}
      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, flexShrink: 0 }}>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={() => setCurrent(1)}>{t('previousButton')}</Button>
          <Button type="primary" onClick={handleSave} loading={isLoading}>
            {isEdit ? t('updateButton') || 'Update' : t('submitButton')}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default EditPreviewAndSubmitStep;
