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
import { TempServicesType } from '@/types/client-portal/temp-client-portal.types';
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

  // Get Ant Design theme tokens
  const { token } = theme.useToken();

  // Responsive height management for MacBook screens
  const getResponsiveHeight = () => {
    if (windowHeight <= 800) {
      // MacBook Air 13" and similar
      return {
        cardMinHeight: 'calc(100vh - 140px)',
        contentMinHeight: 'calc(100vh - 180px)',
      };
    } else if (windowHeight <= 900) {
      // MacBook Pro 13"/14"
      return {
        cardMinHeight: 'calc(100vh - 160px)',
        contentMinHeight: 'calc(100vh - 200px)',
      };
    } else {
      // MacBook Pro 16" and larger screens
      return {
        cardMinHeight: 'calc(100vh - 180px)',
        contentMinHeight: 'calc(100vh - 220px)',
      };
    }
  };

  // localization
  const { t } = useTranslation('client-portal-services');

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // function to handle model close
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
      title: t('serviceDetailsStep'),
      description: 'Basic information about your service',
      icon: current > 0 ? <CheckCircleOutlined /> : undefined,
    },
    {
      title: t('requestFormStep'),
      description: 'Questions clients will answer when requesting',
      icon: current > 1 ? <CheckCircleOutlined /> : undefined,
    },
    {
      title: t('previewAndSubmitStep'),
      description: 'Review and publish your service',
      icon: current > 2 ? <CheckCircleOutlined /> : undefined,
    },
  ];

  // Calculate completion percentage
  const getCompletionPercentage = () => {
    let percentage = 0;

    // Step 1: Service Details (40% of total)
    if (service.name && service.service_data?.description) {
      percentage += 40;
    } else if (service.name || service.service_data?.description) {
      percentage += 20;
    }

    // Step 2: Request Form (30% of total)
    if (current >= 1) {
      if (service.service_data?.request_form && service.service_data.request_form.length > 0) {
        percentage += 30;
      } else {
        percentage += 15;
      }
    }

    // Step 3: Preview (30% of total)
    if (current >= 2) {
      percentage += 30;
    }

    return Math.min(percentage, 100);
  };

  const getStepTitle = () => {
    switch (current) {
      case 0:
        return 'Tell us about your service';
      case 1:
        return 'Create your request form';
      case 2:
        return 'Review and publish';
      default:
        return 'Create Service';
    }
  };

  const getStepDescription = () => {
    switch (current) {
      case 0:
        return 'Start by providing basic information about what you offer. This helps clients understand your service at a glance.';
      case 1:
        return 'Design a form that clients will fill out when requesting your service. This helps you gather the information you need.';
      case 2:
        return 'Take a final look at your service before making it available to clients.';
      default:
        return 'Create a new service for your clients to request';
    }
  };

  return (
    <div
      style={{
        maxWidth: '100%',
        padding: '0 0 16px 0',
      }}
    >
      {/* Header */}
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
            {/* Progress Bar */}
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
                  Step {current + 1} of 3
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {getCompletionPercentage()}% complete
                </Typography.Text>
              </Flex>
            </div>

            {/* Dynamic Title and Description */}
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

            {/* Compact inline tip for larger screens only */}
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
                💡 {current === 0 && 'Use clear, descriptive names and detailed descriptions'}
                {current === 1 && 'Ask specific questions to get the information you need'}
                {current === 2 && 'Review everything before publishing'}
              </Typography.Text>
            )}
          </div>
        </Flex>
      </div>

      {/* Main Content Card */}
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
