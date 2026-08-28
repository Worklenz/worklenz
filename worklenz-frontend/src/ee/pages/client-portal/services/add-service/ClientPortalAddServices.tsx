import {
  Button,
  Card,
  Flex,
  Steps,
  Typography,
  Alert,
  Progress,
  theme,
} from '@/shared/antd-imports';
import React, { useState, useEffect } from 'react';
import { nanoid } from '@reduxjs/toolkit';
import { useTranslation } from 'react-i18next';
import { TempServicesType } from '@/ee/types/client-portal/temp-client-portal.types';
import { ArrowLeftOutlined, InfoCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '@/hooks/useResponsive';
import ServiceDetailsStep from './modal-stepper/ServiceDetailsStep';
import RequestFormStep from './modal-stepper/RequestFormStep';
import PreviewAndSubmitStep from './modal-stepper/PreviewAndSubmitStep';
import './add-service-stepper.css';

const ClientPortalAddServices = () => {
  const [current, setCurrent] = useState(0);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [service, setService] = useState<TempServicesType>({
    id: nanoid(),
    name: '',
    status: 'pending',
    is_public: true,
    service_data: {
      description: '',
      images: [],
      request_form: [],
    },
    no_of_requests: 0,
  });

  const navigate = useNavigate();
  const { isDesktop } = useResponsive();

  const { token } = theme.useToken();

  const getResponsiveHeight = () => {
    if (windowHeight <= 800) {
      return {
        cardMinHeight: 'calc(100vh - 140px)',
        contentMinHeight: 'calc(100vh - 180px)',
      };
    } else if (windowHeight <= 900) {
      return {
        cardMinHeight: 'calc(100vh - 160px)',
        contentMinHeight: 'calc(100vh - 200px)',
      };
    } else {
      return {
        cardMinHeight: 'calc(100vh - 180px)',
        contentMinHeight: 'calc(100vh - 220px)',
      };
    }
  };

  const { t } = useTranslation('client-portal-services');

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleBack = () => {
    navigate(-1);

    setService({
      id: nanoid(),
      name: '',
      status: 'pending',
      is_public: true,
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
      title: t('serviceDetailsStep', { defaultValue: 'Service Details' }),
      description: t('step1Description', { defaultValue: 'Provide basic information about your service.' }),
      icon: current > 0 ? <CheckCircleOutlined /> : undefined,
    },
    {
      title: t('requestFormStep', { defaultValue: 'Request Form' }),
      description: t('step2Description', { defaultValue: 'Build the form your clients will fill.' }),
      icon: current > 1 ? <CheckCircleOutlined /> : undefined,
    },
    {
      title: t('previewAndSubmitStep', { defaultValue: 'Preview & Submit' }),
      description: t('step3Description', { defaultValue: 'Review and publish your service.' }),
      icon: current > 2 ? <CheckCircleOutlined /> : undefined,
    },
  ];

  const getCompletionPercentage = () => {
    let percentage = 0;

    if (service.name && service.service_data?.description) {
      percentage += 40;
    } else if (service.name || service.service_data?.description) {
      percentage += 20;
    }

    if (current >= 1) {
      if (service.service_data?.request_form && service.service_data.request_form.length > 0) {
        percentage += 30;
      } else {
        percentage += 15;
      }
    }

    if (current >= 2) {
      percentage += 30;
    }

    return Math.min(percentage, 100);
  };

  const getStepTitle = () => {
    switch (current) {
      case 0:
        return t('step1Title', { defaultValue: 'Service Details' });
      case 1:
        return t('step2Title', { defaultValue: 'Request Form' });
      case 2:
        return t('step3Title', { defaultValue: 'Preview & Submit' });
      default:
        return t('createServiceTitle', { defaultValue: 'Create Service' });
    }
  };

  const getStepDescription = () => {
    switch (current) {
      case 0:
        return t('step1Description', { defaultValue: 'Provide basic information about your service.' });
      case 1:
        return t('step2Description', { defaultValue: 'Build the form your clients will fill.' });
      case 2:
        return t('step3Description', { defaultValue: 'Review and publish your service.' });
      default:
        return t('createServiceDescription', { defaultValue: 'Create a new service for your clients.' });
    }
  };

  return (
    <div
      style={{
        maxWidth: '100%',
        padding: '0 0 16px 0',
      }}
    >
      <div style={{ marginBottom: isDesktop ? 16 : 12 }}>
        <Flex gap={16} align="flex-start" style={{ width: '100%' }}>
          <Button
            icon={<ArrowLeftOutlined style={{ fontSize: 20 }} />}
            className="borderless-icon-btn"
            style={{ boxShadow: 'none', marginTop: 4 }}
            onClick={handleBack}
            size="large"
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 12 }}>
              <Progress
                percent={getCompletionPercentage()}
                strokeColor={{
                  '0%': token.colorPrimary,
                  '100%': token.colorSuccess,
                }}
                showInfo={false}
                size={['100%', 4]}
                style={{ marginBottom: 4 }}
              />
              <Flex justify="space-between" align="center">
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {t('stepOf3', { current: current + 1, defaultValue: 'Step {{current}} of 3' })}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {t('percentComplete', { percent: getCompletionPercentage(), defaultValue: '{{percent}}% complete' })}
                </Typography.Text>
              </Flex>
            </div>

            <Typography.Title
              level={isDesktop ? 2 : 3}
              style={{
                margin: 0,
                marginBottom: 4,
                fontSize: isDesktop ? '24px' : '20px',
                color: token.colorPrimary,
              }}
            >
              {getStepTitle()}
            </Typography.Title>
            <Typography.Text
              type="secondary"
              style={{
                fontSize: isDesktop ? '14px' : '13px',
                lineHeight: 1.4,
                display: 'block',
                marginBottom: 12,
              }}
            >
              {getStepDescription()}
            </Typography.Text>

            {windowHeight > 800 && (
              <Typography.Text
                type="secondary"
                style={{
                  fontSize: '11px',
                  color: token.colorPrimary,
                  display: 'block',
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                💡{' '}
                {current === 0 && t('step1Tip', { defaultValue: 'Start by giving your service a clear name and description.' })}
                {current === 1 && t('step2Tip', { defaultValue: 'Add questions that help clients provide the information you need.' })}
                {current === 2 && t('step3Tip', { defaultValue: 'Review everything before publishing your service.' })}
              </Typography.Text>
            )}
          </div>
        </Flex>
      </div>

      <Card
        style={{
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderRadius: 8,
          minHeight: getResponsiveHeight().cardMinHeight,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: getResponsiveHeight().contentMinHeight,
          }}
        >
          <Steps
            current={current}
            className="clients-portal-services-steper"
            items={stepItems}
            style={{ marginBottom: 16 }}
            size="small"
          />

          <div style={{ flex: 1, overflow: 'auto' }}>
            {current === 0 && (
              <ServiceDetailsStep
                setCurrent={setCurrent}
                service={service}
                setService={setService}
              />
            )}
            {current === 1 && (
              <RequestFormStep setCurrent={setCurrent} service={service} setService={setService} />
            )}
            {current === 2 && <PreviewAndSubmitStep setCurrent={setCurrent} service={service} />}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClientPortalAddServices;
