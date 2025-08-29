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
import { TempServicesType } from '../../../../../types/client-portal/temp-client-portal.types';
import { useCreateOrganizationServiceMutation } from '../../../../../api/client-portal/client-portal-api';
import { useNavigate } from 'react-router-dom';

type PreviewAndSubmitStepProps = {
  setCurrent: (index: number) => void;
  service: TempServicesType;
};

const PreviewAndSubmitStep = ({ setCurrent, service }: PreviewAndSubmitStepProps) => {
  // localization
  const { t } = useTranslation('client-portal-services');

  const navigate = useNavigate();
  const [createService, { isLoading }] = useCreateOrganizationServiceMutation();

  // function to handle save
  const handleSave = async () => {
    try {
      await createService({
        name: service.name,
        description: service.service_data?.description,
        service_data: service.service_data,
        is_public: false,
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
                      {t('noDescriptionProvided') || 'No description provided'}
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
                    {service.service_data.request_form.length} {t('questionsCount') || 'questions'}
                  </Tag>
                </Flex>
              }
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            >
              <Flex vertical gap={12}>
                {service.service_data.request_form.map((item, index) => (
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
                              {item.answer.map((option, optionIndex) => (
                                <Tag key={optionIndex} style={{ margin: 0 }}>
                                  {option}
                                </Tag>
                              ))}
                            </Flex>
                          </div>
                        )}
                    </Flex>
                  </Card>
                ))}
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
            {t('submitButton')}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default PreviewAndSubmitStep;
