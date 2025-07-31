import React, { useState, useEffect } from 'react';
import { Card, Steps, Spin, Alert, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetOrganizationServiceByIdQuery, useUpdateOrganizationServiceMutation } from '../../../../api/client-portal/client-portal-api';
import { TempServicesType } from '../../../../types/client-portal/temp-client-portal.types';
import ServiceDetailsStep from '../add-service/modal-stepper/service-details-step';
import RequestFormStep from '../add-service/modal-stepper/request-form-step';
import PreviewAndSubmitStep from './edit-preview-and-submit-step';
import './edit-service-stepper.css';

const ClientPortalEditService = () => {
  const { t } = useTranslation('client-portal-services');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Fetch service details
  const { data: serviceData, isLoading, error } = useGetOrganizationServiceByIdQuery(id!);
  
  const [current, setCurrent] = useState(0);
  const [service, setService] = useState<TempServicesType>({
    name: '',
    service_data: {
      description: '',
      images: [],
      request_form: []
    }
  });

  // Load service data when fetched
  useEffect(() => {
    if (serviceData?.body) {
      const fetchedService = serviceData.body;
      setService({
        id: fetchedService.id,
        name: fetchedService.name,
        service_data: {
          description: fetchedService.service_data?.description || '',
          images: fetchedService.service_data?.images || [],
          request_form: fetchedService.service_data?.request_form || []
        }
      });
    }
  }, [serviceData]);

  const steps = [
    {
      title: t('serviceDetailsStep'),
      content: (
        <ServiceDetailsStep
          setCurrent={setCurrent}
          service={service}
          setService={setService}
        />
      ),
    },
    {
      title: t('requestFormStep'),
      content: (
        <RequestFormStep
          setCurrent={setCurrent}
          service={service}
          setService={setService}
        />
      ),
    },
    {
      title: t('previewAndSubmitStep'),
      content: (
        <PreviewAndSubmitStep
          setCurrent={setCurrent}
          service={service}
          isEdit={true}
        />
      ),
    },
  ];

  // Handle loading state
  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <Spin size="large" />
          </div>
        </Card>
      </div>
    );
  }

  // Handle error state
  if (error) {
    const isNotImplemented = (error as any)?.status === 404;
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <Alert
            message={isNotImplemented ? 'Feature Not Yet Available' : (t('errorLoadingService') || 'Error Loading Service')}
            description={
              isNotImplemented 
                ? 'The organization services management feature is currently under development. Please check back later.'
                : (t('errorLoadingServiceDescription') || 'There was an error loading the service. Please try again later.')
            }
            type={isNotImplemented ? "info" : "error"}
            showIcon
          />
        </Card>
      </div>
    );
  }

  // Handle service not found
  if (!isLoading && !serviceData?.body) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <Alert
            message={t('serviceNotFound') || 'Service Not Found'}
            description={t('serviceNotFoundDescription') || 'The requested service could not be found.'}
            type="warning"
            showIcon
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={t('editServiceTitle') || `Edit Service: ${service.name}`}
        style={{ minHeight: 'calc(100vh - 120px)' }}
      >
        <Steps
          current={current}
          items={steps.map(item => ({ title: item.title }))}
          style={{ marginBottom: 24 }}
        />
        
        <div style={{ marginTop: 24 }}>
          {steps[current].content}
        </div>
      </Card>
    </div>
  );
};

export default ClientPortalEditService;