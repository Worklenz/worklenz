import { Button, Flex, Typography } from '@/shared/antd-imports';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { ArrowLeftOutlined } from '@ant-design/icons';
import coverImg from '../../../../assets/images/client-view-service-sample-cover.png';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { toggleRequestFormModal } from '../../../../features/client-view/services/client-view-services';
import RequestFormModal from '../../../../features/client-view/services/request-form-modal/request-form-modal';

const ClientViewServiceDetails = () => {
  // localization
  const { t } = useTranslation('client-view-services');

  const navigate = useNavigate();

  const { services } = useAppSelector(state => state.clientViewReducer.serviceReducer);

  const dispatch = useAppDispatch();

  // get service id from url
  const serviceId = window.location.pathname.split('/').pop();

  // get service details
  const service = services.find(service => service.id === serviceId);

  return (
    <Flex gap={24} style={{ width: '100%' }}>
      <Button
        icon={<ArrowLeftOutlined style={{ fontSize: 22 }} />}
        className="borderless-icon-btn"
        style={{ boxShadow: 'none' }}
        onClick={() => navigate('/client-portal/services')}
      />

      <Flex vertical align="center" gap={24} style={{ width: '100%' }}>
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Flex gap={12} align="center">
            <Typography.Title level={4} style={{ marginBlock: 0 }}>
              {service?.name}
            </Typography.Title>
          </Flex>

          <Button type="primary" onClick={() => dispatch(toggleRequestFormModal())}>
            {t('requestButton')}
          </Button>
        </Flex>

        <Flex vertical gap={24} style={{ width: '100%', maxWidth: 720 }}>
          <img src={coverImg} alt={service?.name} style={{ width: '100%', objectFit: 'cover' }} />

          <div>{service?.service_data?.description}</div>
        </Flex>
      </Flex>

      {/* request form modal  */}
      <RequestFormModal serviceId={service?.id || ''} />
    </Flex>
  );
};

export default ClientViewServiceDetails;
