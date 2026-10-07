import { Flex, Typography, Card, Tag, Divider, theme } from '@/shared/antd-imports';
import { EyeOutlined } from '@ant-design/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TempServicesType } from '../../../../../types/client-portal/temp-client-portal.types';
import { getCurrencyLabel } from '@/shared/currencies';

type PreviewAndSubmitStepProps = {
  service: TempServicesType;
};

/**
 * Read-only "how clients will see this" preview for both create and edit — the Publish/Update
 * action itself lives in the modal's shared footer (ServiceModal), not here.
 */
const PreviewAndSubmitStep = ({ service }: PreviewAndSubmitStepProps) => {
  const { t } = useTranslation('client-portal-services');
  const { token } = theme.useToken();

  const isVisible = service.is_public ?? true;

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 16 }}>
      <Flex vertical gap={24}>
        <Card
          title={
            <Flex align="center" gap={12}>
              <EyeOutlined style={{ color: token.colorPrimary }} />
              <Typography.Title level={5} style={{ margin: 0 }}>
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
              level={3}
              style={{ margin: 0, marginBottom: 8, color: token.colorPrimary, fontSize: 20 }}
            >
              {service.name || t('untitledService', { defaultValue: 'Untitled Service' })}
            </Typography.Title>
            <Tag color={isVisible ? 'green' : 'default'} style={{ marginBottom: 16 }}>
              {isVisible
                ? t('availableForRequest', { defaultValue: 'Available for Request' })
                : t('hiddenFromClients', { defaultValue: 'Hidden from clients' })}
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

          {(service.price || service.category || service.billing_type) && (
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
                      {Number(service.price).toFixed(2)}
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
                {service.billing_type && (
                  <div>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                    >
                      {t('billingTypeLabel', { defaultValue: 'Billing type' })}
                    </Typography.Text>
                    <Tag color="purple" style={{ fontSize: 13 }}>
                      {service.billing_type}
                    </Tag>
                  </div>
                )}
              </Flex>
            </div>
          )}

          <div>
            <Typography.Title level={5} style={{ marginBottom: 12, color: token.colorTextSecondary }}>
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
                  __html: service.service_data.description as string,
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
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {t('requestFormTitle', { defaultValue: 'Request Form' })}
                </Typography.Title>
                <Tag color="blue">
                  {service.service_data.request_form.length}{' '}
                  {t('questionsCountText', {
                    count: service.service_data.request_form.length,
                    defaultValue: 'question(s)',
                  })}
                </Tag>
              </Flex>
            }
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          >
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {t('clientsWillFillText', {
                defaultValue: 'Your clients will fill out this form when requesting this service.',
              })}
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
                    <Typography.Text strong style={{ fontSize: 12 }}>
                      {index + 1}. {item.question}
                    </Typography.Text>
                    <Tag
                      color={
                        item.type === 'text' ? 'green' : item.type === 'multipleChoice' ? 'blue' : 'orange'
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

                  {item.type === 'multipleChoice' && item.answer && Array.isArray(item.answer) && (
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
          <Card style={{ textAlign: 'center', padding: 24, backgroundColor: token.colorFillAlter }}>
            <Typography.Text type="secondary">
              {t('noCustomFormText', { defaultValue: 'No custom form has been added yet.' })}
            </Typography.Text>
          </Card>
        )}
      </Flex>
    </div>
  );
};

export default PreviewAndSubmitStep;
