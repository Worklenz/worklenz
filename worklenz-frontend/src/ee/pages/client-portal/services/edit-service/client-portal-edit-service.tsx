import {
  Button,
  Card,
  Flex,
  Steps,
  Typography,
  Spin,
  Alert,
  Progress,
  theme,
} from '@/shared/antd-imports';
import { ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useGetOrganizationServiceByIdQuery,
  useUpdateOrganizationServiceMutation,
} from '../../../../api/client-portal/client-portal-api';
import { TempServicesType } from '../../../../types/client-portal/temp-client-portal.types';
import ServiceDetailsStep from '../add-service/modal-stepper/ServiceDetailsStep';
import RequestFormStep from '../add-service/modal-stepper/RequestFormStep';
import PreviewAndSubmitStep from './edit-preview-and-submit-step';
import { useResponsive } from '../../../../../hooks/useResponsive';
import '../add-service/add-service-stepper.css';

const ClientPortalEditService = () => {
  const { t } = useTranslation('client-portal-services');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDesktop } = useResponsive();

  const { token } = theme.useToken();

  const { data: serviceData, isLoading, error } = useGetOrganizationServiceByIdQuery(id!);

  const [current, setCurrent] = useState(0);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [service, setService] = useState<TempServicesType>({
    name: '',
    is_public: true,
    service_data: {
      description: '',
      images: [],
      request_form: [],
    },
  });

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

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (serviceData?.body) {
      const fetchedService = serviceData.body;
      setService({
        id: fetchedService.id,
        name: fetchedService.name,
        is_public: fetchedService.is_public ?? true,
        price: fetchedService.price,
        currency: fetchedService.currency,
        category: fetchedService.category,
        service_data: {
          description: fetchedService.service_data?.description || '',
          images: fetchedService.service_data?.images || [],
          request_form: fetchedService.service_data?.request_form || [],
        },
      });
    }
  }, [serviceData]);

  const handleBack = () => {
    navigate(-1);
  };

  const stepItems = [
    {
      title: t('serviceDetailsStep', { defaultValue: 'Service Details' }),
      description: t('editStep1Description', { defaultValue: 'Edit the basic information about your service.' }),
      icon: current > 0 ? <CheckCircleOutlined /> : undefined,
    },
    {
      title: t('requestFormStep', { defaultValue: 'Request Form' }),
      description: t('editStep2Description', { defaultValue: 'Update the form your clients will fill.' }),
      icon: current > 1 ? <CheckCircleOutlined /> : undefined,
    },
    {
      title: t('previewAndSubmitStep', { defaultValue: 'Preview & Submit' }),
      description: t('editStep3Description', { defaultValue: 'Review and save your changes.' }),
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
        return t('editStep1Title', { defaultValue: 'Edit Service Details' });
      case 1:
        return t('editStep2Title', { defaultValue: 'Edit Request Form' });
      case 2:
        return t('editStep3Title', { defaultValue: 'Review & Save' });
      default:
        return t('editServiceTitle', { defaultValue: 'Edit Service' });
    }
  };

  const getStepDescription = () => {
    switch (current) {
      case 0:
        return t('editStep1Description', { defaultValue: 'Edit the basic information about your service.' });
      case 1:
        return t('editStep2Description', { defaultValue: 'Update the form your clients will fill.' });
      case 2:
        return t('editStep3Description', { defaultValue: 'Review and save your changes.' });
      default:
        return t('editServiceDescription', { defaultValue: 'Edit your service details and settings.' });
    }
  };

  if (isLoading) {
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
          }}
        >
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (error) {
    const isNotImplemented = (error as any)?.status === 404;
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <Alert
          message={
            isNotImplemented
              ? t('featureNotAvailable', { defaultValue: 'Feature Not Available' })
              : t('errorLoadingService', { defaultValue: 'Error Loading Service' })
          }
          description={
            isNotImplemented
              ? t('featureNotAvailableDescription', { defaultValue: 'This feature is not yet implemented.' })
              : t('errorLoadingServiceDescription', { defaultValue: 'There was a problem loading this service.' })
          }
          type={isNotImplemented ? 'info' : 'error'}
          showIcon
        />
      </Card>
    );
  }

  if (!isLoading && !serviceData?.body) {
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <Alert
          message={t('serviceNotFound', { defaultValue: 'Service Not Found' })}
          description={t('serviceNotFoundDescription', { defaultValue: 'The requested service could not be found.' })}
          type="warning"
          showIcon
        />
      </Card>
    );
  }

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
                {current === 0 && t('editStep1Tip', { defaultValue: 'Review and update your service name and description.' })}
                {current === 1 && t('editStep2Tip', { defaultValue: 'Modify your request form questions and options.' })}
                {current === 2 && t('editStep3Tip', { defaultValue: 'Preview your changes before saving.' })}
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
            {current === 2 && (
              <PreviewAndSubmitStep setCurrent={setCurrent} service={service} isEdit={true} />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClientPortalEditService;
