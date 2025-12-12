import React from 'react';
import { Button, Typography, Spin, Alert, Card, Row, Col, Tag, Image, Descriptions, Breadcrumb } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useGetServiceDetailsQuery } from '../store/api';

const { Title, Text, Paragraph } = Typography;

interface ServiceData {
  id: string;
  name: string;
  description: string;
  status: string;
  serviceData?: {
    images?: string[];
    description?: string;
  };
  price?: number;
  currency?: string;
  category?: string;
}

const ServiceDetailsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: serviceData, isLoading, error } = useGetServiceDetailsQuery(id || '');
  const service: ServiceData | undefined = serviceData?.body;

  // Get service image
  const getServiceImage = (): string | null => {
    if (service?.serviceData?.images && service.serviceData.images.length > 0) {
      return service.serviceData.images[0];
    }
    return null;
  };

  // Format price with currency
  const formatPrice = (price: number, currency: string): string => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(price);
    } catch {
      return `${currency} ${price}`;
    }
  };

  // Check if price should be displayed
  const shouldShowPrice = (): boolean => {
    return service?.price !== null && service?.price !== undefined && service.price > 0;
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <Alert
        message={t('services.errorLoadingService')}
        description={t('services.errorLoadingServiceDescription')}
        type="error"
        showIcon
      />
    );
  }

  const imageUrl = getServiceImage();

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          {
            title: (
              <span style={{ cursor: 'pointer' }} onClick={() => navigate('/services')}>
                <AppstoreOutlined style={{ marginRight: 4 }} />
                {t('services.title')}
              </span>
            ),
          },
          {
            title: service.name,
          },
        ]}
      />

      {/* Back Button & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/services')}
        />
        <Title level={4} style={{ margin: 0 }}>
          {service.name}
        </Title>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Column - Image & Description */}
        <Col xs={24} lg={16}>
          <Card>
            {/* Service Image - Only show if image exists */}
            {imageUrl && (
              <div
                style={{
                  width: '100%',
                  height: 280,
                  borderRadius: 8,
                  overflow: 'hidden',
                  marginBottom: 24,
                }}
              >
                <Image
                  src={imageUrl}
                  alt={service.name}
                  width="100%"
                  height={280}
                  style={{ objectFit: 'cover' }}
                  preview={true}
                  fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                />
              </div>
            )}

            {/* Description */}
            <div>
              <Title level={5} style={{ marginBottom: 12 }}>
                {t('services.description')}
              </Title>
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {service.description ? (
                  <div dangerouslySetInnerHTML={{ __html: service.description }} />
                ) : (
                  <Text type="secondary">{t('services.noDescription')}</Text>
                )}
              </Paragraph>
            </div>
          </Card>
        </Col>

        {/* Right Column - Details & Action */}
        <Col xs={24} lg={8}>
          {/* Service Details Card */}
          <Card style={{ marginBottom: 16 }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              {t('services.details')}
            </Title>
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label={<Text type="secondary">{t('services.priceLabel')}</Text>}>
                {shouldShowPrice() ? (
                  <Tag color="blue" style={{ margin: 0 }}>
                    {formatPrice(service.price!, service.currency || 'USD')}
                  </Tag>
                ) : (
                  <Tag style={{ margin: 0 }}>{t('services.contactForPrice')}</Tag>
                )}
              </Descriptions.Item>
              {service.category && (
                <Descriptions.Item label={<Text type="secondary">{t('services.categoryLabel')}</Text>}>
                  <Text>{service.category}</Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label={<Text type="secondary">{t('services.status')}</Text>}>
                <Tag color="green" style={{ margin: 0, textTransform: 'capitalize' }}>
                  {service.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Request Service Button */}
          <Button
            type="primary"
            size="large"
            block
            onClick={() => navigate(`/requests/new?service=${service.id}`)}
          >
            {t('services.requestButton')}
          </Button>
        </Col>
      </Row>
    </div>
  );
};

export default ServiceDetailsPage;