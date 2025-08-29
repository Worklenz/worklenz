import React from 'react';
import { Card, Flex, Typography, Spin, Alert } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGetServicesQuery } from '../store/api';
import { ClientService } from '../types';

const { Title, Paragraph } = Typography;

const ServicesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // Fetch services from API
  const { data: servicesData, isLoading, error } = useGetServicesQuery();
  
  const services = servicesData?.body || [];

  // Handle loading state
  if (isLoading) {
    return (
      <Card style={{ height: 'calc(100vh - 248px)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Card style={{ height: 'calc(100vh - 248px)' }}>
        <Alert
          message={t('services.errorLoadingServices', 'Error loading services')}
          description={t('services.errorLoadingServicesDescription', 'Failed to load services. Please try again later.')}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex vertical gap={8}>
        <Title level={1} style={{ margin: 0 }}>Services</Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          {t('services.description', { count: services.length, defaultValue: `Browse our available services (${services.length})` })}
        </Paragraph>
      </Flex>

      <Card style={{ height: 'calc(100vh - 248px)', overflowY: 'auto' }}>
        <Flex gap={24} wrap={'wrap'}>
          {services.map((service: ClientService) => (
            <Card
              key={service.id}
              cover={
                <div
                  style={{
                    height: 180,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}
                >
                  {service.name.charAt(0).toUpperCase()}
                </div>
              }
              style={{ 
                cursor: 'pointer',
                width: 280
              }}
              onClick={() => navigate(`/services/${service.id}`)}
              hoverable
            >
              <Card.Meta
                title={service.name}
                description={service.description || t('services.noDescription', 'No description available')}
              />
              <div style={{ marginTop: 12 }}>
                <Typography.Text type="secondary">
                  {t('services.price', { price: service.price, currency: service.currency, defaultValue: `${service.currency} ${service.price}` })}
                </Typography.Text>
              </div>
            </Card>
          ))}
        </Flex>
        
        {services.length === 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '200px',
            color: '#999'
          }}>
            <Typography.Text type="secondary">
              {t('services.noServices', 'No services available')}
            </Typography.Text>
          </div>
        )}
      </Card>
    </Flex>
  );
};

export default ServicesPage; 