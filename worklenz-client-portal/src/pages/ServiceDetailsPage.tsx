import React from 'react';
import { Button, Flex, Typography, Spin, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useGetServiceDetailsQuery } from '../store/api';

const ServiceDetailsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Fetch service details from API
  const { data: serviceData, isLoading, error } = useGetServiceDetailsQuery(id || '');

  const service = serviceData?.body;

  // Handle loading state
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Handle error state
  if (error || !service) {
    return (
      <Alert
        message={t('services.errorLoadingService', 'Error loading service')}
        description={t('services.errorLoadingServiceDescription', 'Failed to load service details. Please try again later.')}
        type="error"
        showIcon
      />
    );
  }

  return (
    <Flex gap={24} style={{ width: '100%' }}>
      <Button
        icon={<ArrowLeftOutlined style={{ fontSize: 22 }} />}
        className="borderless-icon-btn"
        style={{ boxShadow: 'none' }}
        onClick={() => navigate('/services')}
      />

      <Flex vertical align="center" gap={24} style={{ width: '100%' }}>
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Flex gap={12} align="center">
            <Typography.Title level={4} style={{ marginBlock: 0 }}>
              {service.name}
            </Typography.Title>
          </Flex>

          <Button
            type="primary"
            onClick={() => navigate(`/requests/new?service=${service.id}`)}
          >
            {t('services.requestButton', 'Request Service')}
          </Button>
        </Flex>

        <Flex vertical gap={24} style={{ width: '100%', maxWidth: 720 }}>
          <div
            style={{
              height: 300,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '48px',
              fontWeight: 'bold',
              borderRadius: '8px'
            }}
          >
            {service.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <Typography.Title level={5}>
              {t('services.description', 'Description')}
            </Typography.Title>
            <Typography.Paragraph>
              {service.description || t('services.noDescription', 'No description available')}
            </Typography.Paragraph>
          </div>

          <div>
            <Typography.Title level={5}>
              {t('services.details', 'Service Details')}
            </Typography.Title>
            <Flex vertical gap={8}>
              <Flex justify="space-between">
                <Typography.Text strong>{t('services.price', 'Price')}:</Typography.Text>
                <Typography.Text>{service.currency} {service.price}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>{t('services.category', 'Category')}:</Typography.Text>
                <Typography.Text>{service.category}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>{t('services.status', 'Status')}:</Typography.Text>
                <Typography.Text>{service.status}</Typography.Text>
              </Flex>
            </Flex>
          </div>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default ServiceDetailsPage; 