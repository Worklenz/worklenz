import { Button, Card, Flex, Steps, Typography } from 'antd';
import React, { useState } from 'react';
import { nanoid } from '@reduxjs/toolkit';
import { useTranslation } from 'react-i18next';
import { TempServicesType } from '../../../../types/client-portal/temp-client-portal.types';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ServiceDetailsStep from './modal-stepper/service-details-step';  
import RequestFormStep from './modal-stepper/request-form-step';
import PreviewAndSubmitStep from './modal-stepper/preview-and-submit-step';
import './add-service-stepper.css';

const ClientPortalAddServices = () => {
  const [current, setCurrent] = useState(0);
  const [service, setService] = useState<TempServicesType>({
    id: nanoid(),
    name: '',
    status: 'pending',
    service_data: {
      description: '',
      images: [],
      request_form: [],
    },
    no_of_requests: 0,
    created_by: 'sachintha prasad',
  });

  const navigate = useNavigate();

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

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex gap={12} align="center">
        <Button
          icon={<ArrowLeftOutlined style={{ fontSize: 22 }} />}
          className="borderless-icon-btn"
          style={{ boxShadow: 'none' }}
          onClick={handleBack}
        />

        <Typography.Title level={5} style={{ marginBlock: 0 }}>
          {t('addServiceTitle')}
        </Typography.Title>
      </Flex>

      <Card style={{ width: '100%' }}>
        <Flex
          vertical
          gap={32}
          style={{ height: 'calc(100vh - 330px)', overflow: 'hidden' }}
        >
          <Steps
            type="navigation"
            current={current}
            className="clients-portal-services-steper"
            items={[
              {
                title: t('serviceDetailsStep'),
              },
              {
                title: t('requestFormStep'),
              },
              {
                title: t('previewAndSubmitStep'),
              },
            ]}
          />

          <div>
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
        </Flex>
      </Card>
    </Flex>
  );
};

export default ClientPortalAddServices;
