import React from 'react';
import { Card, Row, Col, Typography, Spin, Alert, Empty, Tag, theme, Image } from '@/shared/antd-imports';
import { AppstoreOutlined, RightOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGetServicesQuery } from '../store/api';
import { stripHtml } from '@/utils/escapeHtml';

const { Title, Text, Paragraph } = Typography;

// Extended service type to include serviceData
interface ServiceItem {
  id: string;
  name: string;
  description: string;
  status: string;
  serviceData?: {
    images?: string[];
    price?: number;
    currency?: string;
  };
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  price?: number;
  currency?: string;
}

const ServicesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  
  const { data: servicesData, isLoading, error } = useGetServicesQuery();
  const services: ServiceItem[] = servicesData?.body || [];

  const stripHtmlAndTruncate = (html: string, maxLength: number = 120): string => {
    if (!html) return '';
    const decoded = stripHtml(html);
    return decoded.length > maxLength ? decoded.substring(0, maxLength) + '...' : decoded;
  };

  // Get price from service - check direct property first, then serviceData
  // Returns null only if price is not set (undefined/null), returns 0 if explicitly set to 0
  const getServicePrice = (service: ServiceItem): number | null => {
    // Check direct price property first
    if (service.price !== null && service.price !== undefined) {
      return service.price;
    }
    // Fall back to serviceData.price
    if (service.serviceData?.price !== null && service.serviceData?.price !== undefined) {
      return service.serviceData.price;
    }
    return null;
  };

  // Check if price should be displayed (price > 0)
  const shouldShowPrice = (price: number | null): boolean => {
    return price !== null && price > 0;
  };

  // Get currency from service
  const getServiceCurrency = (service: ServiceItem): string => {
    return service.currency || service.serviceData?.currency || 'USD';
  };

  // Get service image
  const getServiceImage = (service: ServiceItem): string | null => {
    if (service.serviceData?.images && service.serviceData.images.length > 0) {
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

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message={t('services.errorLoadingServices')}
        description={t('services.errorLoadingServicesDescription')}
        type="error"
        showIcon
      />
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          <AppstoreOutlined style={{ marginRight: 8 }} />
          {t('services.title')} ({services.length})
        </Title>
        <Text type="secondary">
          {t('services.browseServices')}
        </Text>
      </div>

      {services.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('services.noServices')}
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {services.map((service: ServiceItem) => {
            const imageUrl = getServiceImage(service);
            const price = getServicePrice(service);
            const currency = getServiceCurrency(service);

            return (
              <Col xs={24} sm={12} lg={8} xl={6} key={service.id}>
                <Card
                  hoverable
                  onClick={() => navigate(`/services/${service.id}`)}
                  style={{ height: '100%' }}
                  styles={{ body: { padding: 16 } }}
                >
                  {/* Service Image or Icon - Consistent size */}
                  <div 
                    style={{ 
                      width: '100%', 
                      height: 120, 
                      borderRadius: 8,
                      overflow: 'hidden',
                      marginBottom: 12,
                      background: token.colorFillTertiary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={service.name}
                        width="100%"
                        height={120}
                        style={{ objectFit: 'cover' }}
                        preview={false}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                      />
                    ) : (
                      <div 
                        style={{ 
                          width: 56, 
                          height: 56, 
                          borderRadius: 12,
                          background: token.colorPrimaryBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 24,
                          fontWeight: 600,
                          color: token.colorPrimary,
                        }}
                      >
                        {service.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Service Name */}
                  <Title level={5} style={{ marginBottom: 8 }}>
                    {service.name}
                  </Title>

                  {/* Description */}
                  <Paragraph 
                    type="secondary" 
                    style={{ marginBottom: 12, fontSize: 13, minHeight: 40 }}
                    ellipsis={{ rows: 2 }}
                  >
                    {stripHtmlAndTruncate(service.description) || t('services.noDescription')}
                  </Paragraph>

                  {/* Price & Action */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {shouldShowPrice(price) ? (
                      <Tag color="blue">
                        {formatPrice(price!, currency)}
                      </Tag>
                    ) : (
                      <Tag>{t('services.contactForPrice')}</Tag>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('services.viewDetails')} <RightOutlined style={{ fontSize: 10 }} />
                    </Text>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
};

export default ServicesPage;