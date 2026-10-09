import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Modal, Steps, Button, Flex, Spin, message, theme } from '@/shared/antd-imports';
import {
  useGetOrganizationServiceByIdQuery,
  useCreateOrganizationServiceMutation,
  useUpdateOrganizationServiceMutation,
} from '@/api/client-portal/client-portal-api';
import { TempServicesType } from '@/types/client-portal/temp-client-portal.types';
import ServiceDetailsStep from './add-service/modal-stepper/ServiceDetailsStep';
import RequestFormStep from './add-service/modal-stepper/RequestFormStep';
import PreviewAndSubmitStep from './add-service/modal-stepper/PreviewAndSubmitStep';

const SERVICES_PATH = '/worklenz/client-portal/services';

const emptyService: TempServicesType = {
  name: '',
  is_public: true,
  service_data: {
    description: '',
    images: [],
    request_form: [],
  },
};

/**
 * Create (services/create) and edit (services/:id/edit) a service, opened as a modal over the
 * list — same pattern CreateInvoiceModal already uses for invoices. Status/Visibility are not
 * editable here: those commit immediately from the table's own row controls (FR-05).
 */
const ServiceModal = () => {
  const { t } = useTranslation('client-portal-services');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

  const [current, setCurrent] = useState(0);
  const [service, setService] = useState<TempServicesType>(emptyService);
  const [hasLoadedExisting, setHasLoadedExisting] = useState(false);

  // Back to wherever this was opened from, or to the list for a direct link.
  const close = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(SERVICES_PATH);
  };

  const { data: existingData, isLoading: isLoadingExisting } = useGetOrganizationServiceByIdQuery(
    id ?? '',
    { skip: !isEditMode }
  );
  const existing = existingData?.body as any;

  const [createService, { isLoading: isCreating }] = useCreateOrganizationServiceMutation();
  const [updateService, { isLoading: isUpdating }] = useUpdateOrganizationServiceMutation();
  const isSaving = isCreating || isUpdating;

  // Populate from the service being edited (once).
  useEffect(() => {
    if (!existing || hasLoadedExisting) return;
    setHasLoadedExisting(true);
    setService({
      id: existing.id,
      name: existing.name,
      status: existing.status,
      is_public: existing.is_public ?? true,
      price: existing.price,
      currency: existing.currency,
      category: existing.category,
      billing_type: existing.billing_type,
      service_data: {
        description: existing.service_data?.description || '',
        images: existing.service_data?.images || [],
        request_form: existing.service_data?.request_form || [],
      },
    });
  }, [existing, hasLoadedExisting]);

  const stepItems = [
    { title: t('serviceDetailsStep', { defaultValue: 'Service Details' }) },
    { title: t('requestFormStep', { defaultValue: 'Request Form' }) },
    { title: t('previewAndSubmitStep', { defaultValue: 'Preview & Publish' }) },
  ];

  // Publish/Update is blocked until name and description are non-empty, regardless of which
  // step is active.
  const step1Valid = Boolean(
    service.name?.trim() && (service.service_data?.description as string)?.toString().trim()
  );

  const handleSave = async () => {
    const serviceData = { ...service.service_data };
    let imageData: string | undefined;
    let imageName: string | undefined;
    let imageType: string | undefined;

    // A freshly-picked image is still a base64 data URI at this point (see ServiceDetailsStep) —
    // split it out for the backend to upload to S3, whether this is a create or an edit.
    const firstImage = serviceData?.images?.[0];
    if (firstImage && serviceData?.imageFile && firstImage.startsWith('data:')) {
      imageData = firstImage;
      imageName = serviceData.imageFile.fileName;
      imageType = serviceData.imageFile.fileType;
      serviceData.images = [];
      serviceData.imageFile = undefined;
    }

    const description =
      typeof service.service_data?.description === 'string'
        ? service.service_data.description
        : service.service_data?.description?.toString() || '';

    try {
      if (isEditMode && id) {
        await updateService({
          id,
          data: {
            name: service.name,
            description,
            service_data: serviceData,
            is_public: service.is_public,
            price: service.price,
            currency: service.currency,
            category: service.category,
            billing_type: service.billing_type,
            imageData,
            imageName,
            imageType,
          },
        }).unwrap();
        message.success(t('serviceUpdatedSuccessfully', { defaultValue: 'Service updated successfully!' }));
      } else {
        await createService({
          name: service.name,
          description,
          service_data: serviceData,
          is_public: service.is_public ?? true,
          price: service.price,
          currency: service.currency,
          category: service.category,
          billing_type: service.billing_type,
          imageData,
          imageName,
          imageType,
        }).unwrap();
        message.success(t('serviceCreatedSuccessfully', { defaultValue: 'Service created successfully!' }));
      }
      close();
    } catch (error) {
      const errorMessage = (error as { data?: { message?: string } })?.data?.message;
      message.error(
        errorMessage ||
          (isEditMode
            ? t('serviceUpdateFailed', { defaultValue: 'Failed to update service' })
            : t('serviceCreationFailed', { defaultValue: 'Failed to create service' }))
      );
    }
  };

  const isLoading = isEditMode && isLoadingExisting;

  return (
    <Modal
      open
      onCancel={close}
      width="min(880px, 96vw)"
      style={{ top: 24 }}
      maskClosable={false}
      title={
        isEditMode
          ? t('editServiceTitle', { defaultValue: 'Edit Service' })
          : t('createServiceTitle', { defaultValue: 'Create Service' })
      }
      styles={{
        body: {
          padding: 0,
          height: 'calc(100vh - 260px)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      footer={
        <Flex justify="space-between" align="center">
          <Button onClick={() => (current === 0 ? close() : setCurrent(current - 1))}>
            {current === 0
              ? t('cancelButton', { defaultValue: 'Cancel' })
              : t('previousButton', { defaultValue: 'Previous' })}
          </Button>
          {current < 2 ? (
            <Button
              type="primary"
              disabled={current === 0 && !step1Valid}
              onClick={() => setCurrent(current + 1)}
            >
              {t('continueButton', { defaultValue: 'Continue' })}
            </Button>
          ) : (
            <Button type="primary" loading={isSaving} disabled={!step1Valid} onClick={handleSave}>
              {isEditMode
                ? t('updateButton', { defaultValue: 'Update Service' })
                : t('publishButton', { defaultValue: 'Publish Service' })}
            </Button>
          )}
        </Flex>
      }
    >
      {isLoading ? (
        <Flex justify="center" style={{ padding: 48 }}>
          <Spin />
        </Flex>
      ) : (
        <>
          {/* Fixed, non-scrolling — only the step content below it scrolls. */}
          <div
            style={{
              flexShrink: 0,
              padding: '20px 24px 16px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Steps current={current} items={stepItems} size="small" />
          </div>

          <div style={{ flex: 1, minHeight: 0, padding: '20px 24px' }}>
            {current === 0 && <ServiceDetailsStep service={service} setService={setService} />}
            {current === 1 && <RequestFormStep service={service} setService={setService} />}
            {current === 2 && <PreviewAndSubmitStep service={service} />}
          </div>
        </>
      )}
    </Modal>
  );
};

export default ServiceModal;
