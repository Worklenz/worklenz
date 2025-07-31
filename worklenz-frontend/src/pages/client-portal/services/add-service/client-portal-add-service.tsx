import { Button, Card, Flex, Steps, Typography } from 'antd';
import React, { useState } from 'react';
import { nanoid } from '@reduxjs/toolkit';
import { useTranslation } from 'react-i18next';
import { TempServicesType } from '../../../../types/client-portal/temp-client-portal.types';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../../../../hooks/useResponsive';  
import ServiceDetailsStep from './modal-stepper/service-details-step';  
import RequestFormStep from './modal-stepper/request-form-step';
import PreviewAndSubmitStep from './modal-stepper/preview-and-submit-step';
import './add-service-stepper.css';

const ClientPortalAddServices = () => {
  const [current, setCurrent] = useState(0);
  const [service, setService] = useState<TempServicesType>({});

  const navigate = useNavigate();
  const { isDesktop } = useResponsive();

  // localization
  const { t } = useTranslation('client-portal-services');

  // function to handle model close
  const handleBack = () => {
    navigate(-1);

    setService({
      id: nanoid(),
      name: '',
      status: 'pending',
      service_data: {
        description: '',
        images: [],
        request_form: [],
      },
      no_of_requests: 0,
    });
    setCurrent(0);
  };

  const stepItems = [
    {
      title: t('serviceDetailsStep'),
    },
    {
      title: t('requestFormStep'),
    },
    {
      title: t('previewAndSubmitStep'),
    },
  ];

  return (
    <div
      style={{
        maxWidth: '100%',
        minHeight: 'calc(100vh - 120px)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: isDesktop ? 32 : 24 }}>
        <Flex gap={12} align="center" style={{ width: '100%' }}>
          <Button
            icon={<ArrowLeftOutlined style={{ fontSize: 22 }} />}
            className="borderless-icon-btn"
            style={{ boxShadow: 'none' }}
            onClick={handleBack}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Title
              level={isDesktop ? 2 : 3}
              style={{
                margin: 0,
                marginBottom: 8,
                fontSize: isDesktop ? '28px' : '24px',
              }}
            >
              {t('addServiceTitle')}
            </Typography.Title>
            <Typography.Text
              type="secondary"
              style={{
                fontSize: isDesktop ? '16px' : '14px',
                lineHeight: 1.5,
              }}
            >
              Create a new service for your clients to request
            </Typography.Text>
          </div>
        </Flex>
      </div>

      {/* Main Content Card */}
      <Card
        style={{
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderRadius: 8,
        }}
      >
        <div style={{ height: 'calc(100vh - 330px)', display: 'flex', flexDirection: 'column' }}>
          <Steps
            type="navigation"
            current={current}
            className="clients-portal-services-steper"
            items={stepItems}
            style={{ marginBottom: 32 }}
          />

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {current === 0 && (
              <ServiceDetailsStep
                setCurrent={setCurrent}
                service={service}
                setService={setService}
              />
            )}
            {current === 1 && (
              <RequestFormStep
                setCurrent={setCurrent}
                service={service}
                setService={setService}
              />
            )}
            {current === 2 && (
              <PreviewAndSubmitStep setCurrent={setCurrent} service={service} />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClientPortalAddServices;
