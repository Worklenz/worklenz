import { Card, Flex, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../hooks/useAppSelector';
import coverImg from '../../../assets/images/client-view-service-sample-cover.png';
import { useNavigate } from 'react-router-dom';

const ClientViewServices = () => {
  // localization
  const { t } = useTranslation('client-view-services');

  const navigate = useNavigate();

  const { services } = useAppSelector(
    (state) => state.clientViewReducer.serviceReducer
  );

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ marginBlock: 0 }}>
          {t('title', { items: services.length })}
        </Typography.Title>
      </Flex>

      <Card style={{ height: 'calc(100vh - 248px)', overflowY: 'auto' }}>
        <Flex gap={24} wrap={'wrap'}>
          {services.map((service) => (
            <Card
              cover={
                <img
                  src={coverImg}
                  alt={service.name}
                  style={{ height: 180 }}
                />
              }
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/client-portal/services/${service.id}`)}
            >
              <Card.Meta
                title={service.name}
                description={service.service_data?.description}
              />
            </Card>
          ))}
        </Flex>
      </Card>
    </Flex>
  );
};

export default ClientViewServices;
